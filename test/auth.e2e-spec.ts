import { Controller, Get } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import { RequirePermissions } from "@/common/decorators/require-permissions.decorator.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";

import { authHeader, createTestApp, createUser, resetDatabase } from "./helpers.js";

@Controller("admin-only")
class AdminOnlyController {
  @Get()
  @RequirePermissions("user:manage")
  get() {
    return { ok: true };
  }
}

const login = (app: NestExpressApplication, email: string, password: string) =>
  request(app.getHttpServer()).post("/v1/auth/login").send({ email, password });

const refresh = (app: NestExpressApplication, refreshToken: string) =>
  request(app.getHttpServer()).post("/v1/auth/refresh").send({ refreshToken });

describe("Auth (e2e)", () => {
  let app: NestExpressApplication;

  // A fresh app per test also resets the in-memory login rate limiter.
  beforeEach(async () => {
    app = await createTestApp([AdminOnlyController]);
    await resetDatabase(app);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("POST /v1/auth/login", () => {
    it("returns a token pair that works on /me", async () => {
      const user = await createUser(app, { permissions: ["user:read"] });

      const res = await login(app, user.email.toUpperCase(), user.password).expect(200);
      expect(res.body).toEqual({
        accessToken: expect.any(String),
        accessTokenExpiresAt: expect.any(String),
        refreshToken: expect.any(String),
        refreshTokenExpiresAt: expect.any(String),
      });

      const me = await request(app.getHttpServer())
        .get("/v1/auth/me")
        .set("Authorization", `Bearer ${res.body.accessToken}`)
        .expect(200);
      expect(me.body).toEqual({
        id: user.id,
        email: user.email,
        name: expect.any(String),
        organizationId: user.organizationId,
        permissions: ["user:read"],
      });
    });

    it("gives the same error for a wrong password, unknown email and disabled user", async () => {
      const user = await createUser(app);
      const disabled = await createUser(app, { disabled: true });

      for (const [email, password] of [
        [user.email, "wrong-password"],
        ["nobody@example.test", "whatever-password"],
        [disabled.email, disabled.password],
      ] as const) {
        const res = await login(app, email, password).expect(401);
        expect(res.body.error).toMatchObject({
          code: "INVALID_CREDENTIALS",
          message: "Email or password is incorrect.",
        });
      }
    });

    it("validates the body", async () => {
      const res = await login(app, "not-an-email", "").expect(400);
      expect(Object.keys(res.body.error.details.fieldErrors)).toEqual(["email", "password"]);
    });

    it("rate limits repeated attempts for the same client and email", async () => {
      for (let i = 0; i < 5; i++) await login(app, "nobody@example.test", "x").expect(401);
      const res = await login(app, "nobody@example.test", "x").expect(429);
      expect(res.body.error.code).toBe("RATE_LIMITED");
    });

    // The frontend calls login server-to-server, so every user arrives from the
    // same socket address. The limit must follow the forwarded client IP.
    it("gives each forwarded client IP its own budget", async () => {
      const from = (ip: string) =>
        request(app.getHttpServer())
          .post("/v1/auth/login")
          .set("X-Forwarded-For", ip)
          .send({ email: "nobody@example.test", password: "x" });

      for (let i = 0; i < 5; i++) await from("203.0.113.10").expect(401);
      await from("203.0.113.10").expect(429);
      await from("203.0.113.20").expect(401);
    });

    it("gives each email its own budget from the same client", async () => {
      for (let i = 0; i < 5; i++) await login(app, "first@example.test", "x").expect(401);
      await login(app, "FIRST@example.test", "x").expect(429); // case-insensitive
      await login(app, "second@example.test", "x").expect(401);
    });

    it("caps one client across many emails (credential stuffing)", async () => {
      for (let i = 0; i < 20; i++) await login(app, `victim${i}@example.test`, "x").expect(401);
      const res = await login(app, "victim20@example.test", "x").expect(429);
      expect(res.body.error.code).toBe("RATE_LIMITED");
    });
  });

  describe("access tokens", () => {
    it("rejects missing and malformed tokens", async () => {
      const server = app.getHttpServer();
      const missing = await request(server).get("/v1/auth/me").expect(401);
      expect(missing.body.error.code).toBe("UNAUTHENTICATED");
      await request(server).get("/v1/auth/me").set("Authorization", "Bearer a.b.c").expect(401);
    });

    it("reports expired tokens with TOKEN_EXPIRED so the client can refresh", async () => {
      const user = await createUser(app);
      const res = await request(app.getHttpServer())
        .get("/v1/auth/me")
        .set(await authHeader(app, user, { expiresIn: -10 }))
        .expect(401);
      expect(res.body.error.code).toBe("TOKEN_EXPIRED");
    });

    it("stops working as soon as the user is disabled", async () => {
      const user = await createUser(app);
      const headers = await authHeader(app, user);
      await app
        .get(PrismaService)
        .user.update({ where: { id: user.id }, data: { disabledAt: new Date() } });

      await request(app.getHttpServer()).get("/v1/auth/me").set(headers).expect(401);
    });
  });

  describe("POST /v1/auth/refresh", () => {
    it("rotates the refresh token", async () => {
      const user = await createUser(app);
      const first = (await login(app, user.email, user.password).expect(200)).body;

      const second = (await refresh(app, first.refreshToken).expect(200)).body;
      expect(second.refreshToken).not.toBe(first.refreshToken);

      await request(app.getHttpServer())
        .get("/v1/auth/me")
        .set("Authorization", `Bearer ${second.accessToken}`)
        .expect(200);
    });

    it("revokes the whole session when a rotated token is reused", async () => {
      const user = await createUser(app);
      const first = (await login(app, user.email, user.password).expect(200)).body;
      const second = (await refresh(app, first.refreshToken).expect(200)).body;

      // Move the first rotation outside the concurrency grace window.
      await app.get(PrismaService).refreshToken.updateMany({
        where: { usedAt: { not: null } },
        data: { usedAt: new Date(Date.now() - 60_000) },
      });

      const reused = await refresh(app, first.refreshToken).expect(401);
      expect(reused.body.error.code).toBe("REFRESH_TOKEN_REUSED");

      // The legitimate holder is logged out too: both their tokens are dead.
      await refresh(app, second.refreshToken).expect(401);
      await request(app.getHttpServer())
        .get("/v1/auth/me")
        .set("Authorization", `Bearer ${second.accessToken}`)
        .expect(401);
    });

    it("treats parallel refreshes with the same token as concurrency, not theft", async () => {
      const user = await createUser(app);
      const { refreshToken } = (await login(app, user.email, user.password).expect(200)).body;

      const results = await Promise.all([refresh(app, refreshToken), refresh(app, refreshToken)]);

      expect(results.map((r) => r.status)).toEqual([200, 200]);
      await refresh(app, results[1]?.body.refreshToken).expect(200);
    });

    it("rejects unknown tokens", async () => {
      const res = await refresh(app, "x".repeat(43)).expect(401);
      expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    });
  });

  describe("POST /v1/auth/logout", () => {
    it("ends the session: access and refresh tokens stop working", async () => {
      const user = await createUser(app);
      const tokens = (await login(app, user.email, user.password).expect(200)).body;
      const auth = { Authorization: `Bearer ${tokens.accessToken}` };

      await request(app.getHttpServer()).post("/v1/auth/logout").set(auth).expect(204);

      await request(app.getHttpServer()).get("/v1/auth/me").set(auth).expect(401);
      await refresh(app, tokens.refreshToken).expect(401);
    });
  });

  describe("permissions", () => {
    it("returns 403 without the permission and 200 with it", async () => {
      const member = await createUser(app, { permissions: ["user:read"] });
      const admin = await createUser(app, { permissions: ["user:manage"] });
      const server = app.getHttpServer();

      const denied = await request(server)
        .get("/v1/admin-only")
        .set(await authHeader(app, member))
        .expect(403);
      expect(denied.body.error.code).toBe("FORBIDDEN");
      await request(server)
        .get("/v1/admin-only")
        .set(await authHeader(app, admin))
        .expect(200);
    });
  });
});

describe("Route auth audit", () => {
  @Controller("forgotten")
  class ForgottenController {
    @Get()
    get() {
      return {};
    }
  }

  it("refuses to start when a route has no access decorator", async () => {
    await expect(createTestApp([ForgottenController])).rejects.toThrow(/ForgottenController\.get/);
  });
});
