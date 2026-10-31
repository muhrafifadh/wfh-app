import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import { MailService } from "@/infra/mail/mail.service.js";
import { MemoryMailer } from "@/infra/mail/mailers.js";

import {
  authHeader,
  createTestApp,
  createUser,
  resetDatabase,
  waitForJobs,
  type TestUser,
} from "./helpers.js";

const NEW_PASSWORD = "a-brand-new-long-password";

describe("Users (e2e)", () => {
  let app: NestExpressApplication;
  let admin: TestUser;

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    admin = await createUser(app, { permissions: ["user:read", "user:manage"] });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const as = async (user: TestUser) => authHeader(app, user);
  const mailbox = () => {
    const mailer = app.get(MailService);
    if (!(mailer instanceof MemoryMailer)) throw new Error("tests expect MAIL_TRANSPORT=memory");
    return mailer.sent;
  };
  const tokenFrom = (text: string | undefined) => {
    const match = /token=([\w-]+)/.exec(text ?? "");
    if (!match?.[1]) throw new Error("no link in email");
    return match[1];
  };
  const invite = async (body: Partial<{ email: string; name: string; roleId: string }> = {}) =>
    http()
      .post("/v1/users")
      .set(await as(admin))
      .send({ email: "new@example.test", name: "New Person", roleId: admin.roleId, ...body });

  describe("GET /v1/users", () => {
    it("requires a signed-in user", async () => {
      await http().get("/v1/users").expect(401);
    });

    it("requires user:read", async () => {
      const nobody = await createUser(app);
      const res = await http()
        .get("/v1/users")
        .set(await as(nobody))
        .expect(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("lists only the caller's organization, paginated", async () => {
      await createUser(app, { sameOrganizationAs: admin });
      await createUser(app); // another organization

      const res = await http()
        .get("/v1/users?pageSize=1&sort=email")
        .set(await as(admin))
        .expect(200);

      expect(res.body).toMatchObject({ page: 1, pageSize: 1, total: 2 });
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toEqual({
        id: admin.id,
        email: admin.email,
        name: expect.any(String),
        role: { id: admin.roleId, name: expect.any(String) },
        status: "active",
        emailVerified: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
      expect(res.body.items[0]).not.toHaveProperty("passwordHash");
    });

    it("filters by search text and status", async () => {
      await invite({ email: "grace@example.test", name: "Grace Hopper" });

      const byName = await http()
        .get("/v1/users?q=hopper")
        .set(await as(admin))
        .expect(200);
      expect(byName.body.items.map((u: { email: string }) => u.email)).toEqual([
        "grace@example.test",
      ]);

      const invited = await http()
        .get("/v1/users?status=invited")
        .set(await as(admin))
        .expect(200);
      expect(invited.body.total).toBe(1);
    });

    it("rejects unknown sort fields and oversized pages", async () => {
      const res = await http()
        .get("/v1/users?sort=passwordHash&pageSize=500")
        .set(await as(admin))
        .expect(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
      expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["pageSize", "sort"]);
    });
  });

  describe("GET /v1/users/:id", () => {
    it("returns 404 for a user in another organization", async () => {
      const foreign = await createUser(app, { permissions: ["user:read"] });
      await http()
        .get(`/v1/users/${foreign.id}`)
        .set(await as(admin))
        .expect(404);
    });

    it("rejects an id that isn't a UUID", async () => {
      await http()
        .get("/v1/users/not-a-uuid")
        .set(await as(admin))
        .expect(400);
    });
  });

  describe("inviting", () => {
    it("requires user:manage", async () => {
      const reader = await createUser(app, { permissions: ["user:read"] });
      await http()
        .post("/v1/users")
        .set(await as(reader))
        .send({ email: "x@example.test", name: "X", roleId: reader.roleId })
        .expect(403);
    });

    it("creates an invited user and emails them a link that signs them in", async () => {
      const res = await invite({ email: "Grace@Example.test" });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        email: "grace@example.test",
        status: "invited",
        emailVerified: false,
      });

      // Can't sign in before accepting
      await http()
        .post("/v1/auth/login")
        .send({ email: "grace@example.test", password: NEW_PASSWORD })
        .expect(401);

      await waitForJobs(app);
      expect(mailbox()).toHaveLength(1);
      expect(mailbox()[0]?.to).toBe("grace@example.test");
      expect(mailbox()[0]?.text).toContain("http://localhost:3000/accept-invite?token=");
      const token = tokenFrom(mailbox()[0]?.text);

      const accepted = await http()
        .post("/v1/auth/invitations/accept")
        .send({ token, password: NEW_PASSWORD })
        .expect(200);
      const me = await http()
        .get("/v1/auth/me")
        .set("Authorization", `Bearer ${accepted.body.accessToken}`)
        .expect(200);
      expect(me.body).toMatchObject({ email: "grace@example.test", emailVerified: true });

      // Single use
      const reuse = await http()
        .post("/v1/auth/invitations/accept")
        .send({ token, password: NEW_PASSWORD })
        .expect(400);
      expect(reuse.body.error.code).toBe("INVALID_INVITATION_TOKEN");
    });

    it("rejects an email that already has an account", async () => {
      const res = await invite({ email: admin.email });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMAIL_TAKEN");
    });

    it("rejects a role from another organization", async () => {
      const foreign = await createUser(app);
      const res = await invite({ roleId: foreign.roleId });
      expect(res.status).toBe(404);
    });

    it("validates the body", async () => {
      const res = await invite({ email: "nope", name: "" });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["email", "name"]);
    });

    it("resends only to users who haven't accepted", async () => {
      const invited = (await invite()).body;
      await http()
        .post(`/v1/users/${invited.id}/invitation`)
        .set(await as(admin))
        .expect(202);
      const res = await http()
        .post(`/v1/users/${admin.id}/invitation`)
        .set(await as(admin))
        .expect(409);
      expect(res.body.error.code).toBe("USER_NOT_INVITED");
    });
  });

  describe("PATCH /v1/users/:id", () => {
    it("renames a user and changes their role", async () => {
      const member = await createUser(app, { sameOrganizationAs: admin });
      const res = await http()
        .patch(`/v1/users/${member.id}`)
        .set(await as(admin))
        .send({ name: "Renamed", roleId: admin.roleId })
        .expect(200);
      expect(res.body).toMatchObject({ name: "Renamed", role: { id: admin.roleId } });
    });

    it("won't change your own role", async () => {
      const otherRole = (await createUser(app, { sameOrganizationAs: admin })).roleId;
      const res = await http()
        .patch(`/v1/users/${admin.id}`)
        .set(await as(admin))
        .send({ roleId: otherRole })
        .expect(422);
      expect(res.body.error.code).toBe("CANNOT_CHANGE_OWN_ACCOUNT");
    });

    it("rejects an empty update and unknown fields", async () => {
      await http()
        .patch(`/v1/users/${admin.id}`)
        .set(await as(admin))
        .send({})
        .expect(400);
      await http()
        .patch(`/v1/users/${admin.id}`)
        .set(await as(admin))
        .send({ email: "changed@example.test" })
        .expect(400);
    });
  });

  describe("deactivating", () => {
    it("blocks sign-in, ends sessions, and can be undone", async () => {
      const member = await createUser(app, { sameOrganizationAs: admin });
      const memberAuth = await as(member);
      await http().get("/v1/auth/me").set(memberAuth).expect(200);

      const res = await http()
        .post(`/v1/users/${member.id}/deactivate`)
        .set(await as(admin))
        .expect(200);
      expect(res.body.status).toBe("deactivated");
      await http().get("/v1/auth/me").set(memberAuth).expect(401);
      await http()
        .post("/v1/auth/login")
        .send({ email: member.email, password: member.password })
        .expect(401);

      await http()
        .post(`/v1/users/${member.id}/reactivate`)
        .set(await as(admin))
        .expect(200);
      // Their old session stays revoked; they sign in again
      await http().get("/v1/auth/me").set(memberAuth).expect(401);
      await http()
        .post("/v1/auth/login")
        .send({ email: member.email, password: member.password })
        .expect(200);
    });

    it("won't deactivate yourself", async () => {
      const res = await http()
        .post(`/v1/users/${admin.id}/deactivate`)
        .set(await as(admin))
        .expect(422);
      expect(res.body.error.code).toBe("CANNOT_CHANGE_OWN_ACCOUNT");
    });

    it("returns 404 for a user in another organization", async () => {
      const foreign = await createUser(app);
      await http()
        .post(`/v1/users/${foreign.id}/deactivate`)
        .set(await as(admin))
        .expect(404);
    });
  });

  describe("GET /v1/roles", () => {
    it("lists the organization's roles", async () => {
      await createUser(app); // another organization's role must not appear
      const res = await http()
        .get("/v1/roles")
        .set(await as(admin))
        .expect(200);
      expect(res.body.items).toEqual([
        { id: admin.roleId, name: expect.any(String), permissions: ["user:read", "user:manage"] },
      ]);
    });
  });
});

describe("Email verification (e2e)", () => {
  let app: NestExpressApplication;

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const mailbox = () => {
    const mailer = app.get(MailService);
    if (!(mailer instanceof MemoryMailer)) throw new Error("tests expect MAIL_TRANSPORT=memory");
    return mailer.sent;
  };

  it("verifies with the emailed link, once", async () => {
    const user = await createUser(app, { emailVerified: false });
    const auth = await authHeader(app, user);

    await http().post("/v1/auth/email-verification/resend").set(auth).expect(202);
    await waitForJobs(app);
    const token = /token=([\w-]+)/.exec(mailbox()[0]?.text ?? "")?.[1];
    expect(mailbox()[0]?.text).toContain("http://localhost:3000/verify-email?token=");

    await http().post("/v1/auth/email-verification/confirm").send({ token }).expect(204);
    const me = await http().get("/v1/auth/me").set(auth).expect(200);
    expect(me.body.emailVerified).toBe(true);

    const reuse = await http()
      .post("/v1/auth/email-verification/confirm")
      .send({ token })
      .expect(400);
    expect(reuse.body.error.code).toBe("INVALID_VERIFICATION_TOKEN");
  });

  it("sends nothing when the email is already verified", async () => {
    const user = await createUser(app);
    await http()
      .post("/v1/auth/email-verification/resend")
      .set(await authHeader(app, user))
      .expect(202);
    await waitForJobs(app);
    expect(mailbox()).toHaveLength(0);
  });

  it("requires a signed-in user to resend", async () => {
    await http().post("/v1/auth/email-verification/resend").expect(401);
  });
});
