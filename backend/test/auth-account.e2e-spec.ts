import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import { PERMISSIONS } from "@/common/types/auth.js";
import { MailService } from "@/infra/mail/mail.service.js";
import { MemoryMailer } from "@/infra/mail/mailers.js";
import { PasswordResetService } from "@/modules/auth/password-reset.service.js";

import { createTestApp, createUser, PrismaService, resetDatabase, waitForJobs } from "./helpers.js";
import { decodeBody, startSmtpTestServer } from "./support/smtp-test-server.js";

const NEW_PASSWORD = "a-brand-new-long-password";

describe("Account (e2e)", () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const login = (email: string, password: string) =>
    http().post("/v1/auth/login").send({ email, password });
  const mailbox = () => {
    const mailer = app.get(MailService);
    if (!(mailer instanceof MemoryMailer)) throw new Error("tests expect MAIL_TRANSPORT=memory");
    return mailer.sent;
  };
  const resetTokenFrom = (text: string) => {
    const match = /token=([\w-]+)/.exec(text);
    if (!match?.[1]) throw new Error("no reset link in email");
    return match[1];
  };

  describe("POST /v1/auth/register", () => {
    const body = {
      name: "Ada",
      email: "Ada@Example.test",
      password: "correct-horse-battery",
      organizationName: "Analytical Engines",
    };

    it("creates an organization owned by the new user and signs them in", async () => {
      const res = await http().post("/v1/auth/register").send(body).expect(201);

      const me = await http()
        .get("/v1/auth/me")
        .set("Authorization", `Bearer ${res.body.accessToken}`)
        .expect(200);
      expect(me.body).toMatchObject({
        email: "ada@example.test",
        name: "Ada",
        emailVerified: false,
        permissions: [...PERMISSIONS],
      });

      // A verification link is on its way
      await waitForJobs(app);
      expect(mailbox()).toHaveLength(1);
      expect(mailbox()[0]?.text).toContain("http://localhost:3000/verify-email?token=");

      const roles = await app.get(PrismaService).role.findMany({
        where: { organizationId: me.body.organizationId },
        select: { name: true },
        orderBy: { name: "asc" },
      });
      expect(roles.map((r) => r.name)).toEqual([
        "admin_hr",
        "employee",
        "manager",
        "member",
        "owner",
      ]);
    });

    it("rejects an email that is already registered", async () => {
      await http().post("/v1/auth/register").send(body).expect(201);
      const res = await http()
        .post("/v1/auth/register")
        .send({ ...body, email: "ada@example.test" })
        .expect(409);
      expect(res.body.error).toMatchObject({ code: "EMAIL_TAKEN" });
      expect(res.body.error.details.fieldErrors.email).toBeDefined();
    });

    it("requires a password of at least 12 characters", async () => {
      const res = await http()
        .post("/v1/auth/register")
        .send({ ...body, password: "short" })
        .expect(400);
      expect(res.body.error.details.fieldErrors.password).toEqual(["Use at least 12 characters"]);
    });
  });

  describe("POST /v1/auth/logout-all", () => {
    it("ends every session of the user", async () => {
      const user = await createUser(app);
      const first = (await login(user.email, user.password).expect(200)).body;
      const second = (await login(user.email, user.password).expect(200)).body;

      await http()
        .post("/v1/auth/logout-all")
        .set("Authorization", `Bearer ${first.accessToken}`)
        .expect(204);

      for (const tokens of [first, second]) {
        await http()
          .get("/v1/auth/me")
          .set("Authorization", `Bearer ${tokens.accessToken}`)
          .expect(401);
        await http()
          .post("/v1/auth/refresh")
          .send({ refreshToken: tokens.refreshToken })
          .expect(401);
      }
    });

    it("requires a signed-in user", async () => {
      await http().post("/v1/auth/logout-all").expect(401);
    });
  });

  describe("password reset", () => {
    it("answers 202 for unknown emails without sending anything", async () => {
      await http()
        .post("/v1/auth/password-reset/request")
        .send({ email: "nobody@example.test" })
        .expect(202);
      await waitForJobs(app);
      expect(mailbox()).toHaveLength(0);
    });

    it("resets the password with the emailed link and signs out everywhere", async () => {
      const user = await createUser(app);
      const before = (await login(user.email, user.password).expect(200)).body;

      await http().post("/v1/auth/password-reset/request").send({ email: user.email }).expect(202);
      await waitForJobs(app);
      expect(mailbox()).toHaveLength(1);
      const message = mailbox()[0];
      expect(message?.to).toBe(user.email);
      expect(message?.text).toContain("http://localhost:3000/reset-password?token=");
      const token = resetTokenFrom(message?.text ?? "");

      await http()
        .post("/v1/auth/password-reset/confirm")
        .send({ token, password: NEW_PASSWORD })
        .expect(204);

      // Old session is gone, old password fails, new one works
      await http()
        .get("/v1/auth/me")
        .set("Authorization", `Bearer ${before.accessToken}`)
        .expect(401);
      await login(user.email, user.password).expect(401);
      await login(user.email, NEW_PASSWORD).expect(200);
    });

    it("accepts each link only once", async () => {
      const user = await createUser(app);
      await http().post("/v1/auth/password-reset/request").send({ email: user.email }).expect(202);
      await waitForJobs(app);
      const token = resetTokenFrom(mailbox()[0]?.text ?? "");

      await http()
        .post("/v1/auth/password-reset/confirm")
        .send({ token, password: NEW_PASSWORD })
        .expect(204);
      const res = await http()
        .post("/v1/auth/password-reset/confirm")
        .send({ token, password: "yet-another-long-password" })
        .expect(400);
      expect(res.body.error.code).toBe("INVALID_RESET_TOKEN");
    });

    it("sends one email for repeated requests within a minute", async () => {
      const user = await createUser(app);
      for (let i = 0; i < 3; i++) {
        await http()
          .post("/v1/auth/password-reset/request")
          .send({ email: user.email })
          .expect(202);
      }
      await waitForJobs(app);
      expect(mailbox()).toHaveLength(1);
    });

    it("only honours the newest link", async () => {
      const user = await createUser(app);
      // What two jobs a minute apart do (the queue dedupes requests within a minute)
      await app.get(PasswordResetService).send(user.id);
      await app.get(PasswordResetService).send(user.id);
      const [older, newer] = mailbox().map((m) => resetTokenFrom(m.text));

      await http()
        .post("/v1/auth/password-reset/confirm")
        .send({ token: older, password: NEW_PASSWORD })
        .expect(400);
      await http()
        .post("/v1/auth/password-reset/confirm")
        .send({ token: newer, password: NEW_PASSWORD })
        .expect(204);
    });

    it("rejects expired links", async () => {
      const user = await createUser(app);
      await http().post("/v1/auth/password-reset/request").send({ email: user.email }).expect(202);
      await waitForJobs(app);
      const token = resetTokenFrom(mailbox()[0]?.text ?? "");
      await app
        .get(PrismaService)
        .passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

      await http()
        .post("/v1/auth/password-reset/confirm")
        .send({ token, password: NEW_PASSWORD })
        .expect(400);
    });
  });
});

describe("Registration switched off", () => {
  it("hides the endpoint behind a 404", async () => {
    const app = await createTestApp([], { config: { REGISTRATION_ENABLED: false } });
    try {
      const res = await request(app.getHttpServer())
        .post("/v1/auth/register")
        .send({
          name: "A",
          email: "a@example.test",
          password: "correct-horse-battery",
          organizationName: "O",
        })
        .expect(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    } finally {
      await app.close();
    }
  });
});

describe("Password reset over SMTP", () => {
  const smtpConfig = (url: string) => ({
    MAIL_TRANSPORT: "smtp" as const,
    SMTP_URL: url,
    MAIL_FROM: "Boilerplate <no-reply@example.test>",
  });

  it("delivers the reset email through the SMTP server", async () => {
    const smtp = await startSmtpTestServer();
    const app = await createTestApp([], { config: smtpConfig(smtp.url) });
    try {
      await resetDatabase(app);
      const user = await createUser(app);

      await request(app.getHttpServer())
        .post("/v1/auth/password-reset/request")
        .send({ email: user.email })
        .expect(202);
      await waitForJobs(app);

      expect(smtp.received).toHaveLength(1);
      expect(smtp.received[0]?.to).toEqual([user.email]);
      expect(decodeBody(smtp.received[0]?.raw ?? "")).toMatch(
        /http:\/\/localhost:3000\/reset-password\?token=[\w-]{40,}/,
      );
    } finally {
      await app.close();
      await smtp.close();
    }
  });

  it("still answers 202 when SMTP is down, so it can't reveal which emails exist", async () => {
    const smtp = await startSmtpTestServer();
    await smtp.close();
    const app = await createTestApp([], { config: smtpConfig(smtp.url) });
    try {
      await resetDatabase(app);
      const user = await createUser(app);

      await request(app.getHttpServer())
        .post("/v1/auth/password-reset/request")
        .send({ email: user.email })
        .expect(202);
    } finally {
      await app.close();
    }
  });
});
