import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import { authHeader, createTestApp, createUser, resetDatabase, type TestUser } from "./helpers.js";

describe("Audit log (e2e)", () => {
  let app: NestExpressApplication;
  let admin: TestUser;

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    admin = await createUser(app, { permissions: ["user:read", "user:manage", "audit:read"] });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  it("records user changes with who did them and the request id", async () => {
    const member = await createUser(app, { sameOrganizationAs: admin });
    const auth = await authHeader(app, admin);
    await http()
      .post(`/v1/users/${member.id}/deactivate`)
      .set(auth)
      .set("X-Request-Id", "audit-test-request-1")
      .expect(200);

    const res = await http().get("/v1/audit-logs").set(auth).expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0]).toEqual({
      id: expect.any(String),
      action: "user.deactivated",
      actor: { id: admin.id, name: expect.any(String), email: admin.email },
      targetType: "user",
      targetId: member.id,
      metadata: {},
      requestId: "audit-test-request-1",
      createdAt: expect.any(String),
    });
  });

  it("records sign-ins and filters by action, newest first", async () => {
    await http()
      .post("/v1/auth/login")
      .send({ email: admin.email, password: admin.password })
      .expect(200);
    const auth = await authHeader(app, admin);
    await http().patch(`/v1/users/${admin.id}`).set(auth).send({ name: "Renamed" }).expect(200);

    const all = await http().get("/v1/audit-logs").set(auth).expect(200);
    expect(all.body.items.map((e: { action: string }) => e.action)).toEqual([
      "user.updated",
      "user.signed_in",
    ]);
    expect(all.body.items[0].metadata).toEqual({ fields: ["name"] });

    const signIns = await http().get("/v1/audit-logs?action=user.signed_in").set(auth).expect(200);
    expect(signIns.body.total).toBe(1);
  });

  it("records failed sign-ins on existing accounts", async () => {
    await http()
      .post("/v1/auth/login")
      .send({ email: admin.email, password: "not-the-password" })
      .expect(401);
    await http()
      .post("/v1/auth/login")
      .send({ email: "nobody@example.test", password: "not-the-password" })
      .expect(401);

    // Written without delaying the response (see AuthService.login), so wait for it
    const auth = await authHeader(app, admin);
    const failures = async () =>
      (await http().get("/v1/audit-logs?action=user.sign_in_failed").set(auth).expect(200)).body
        .items;
    await expect.poll(failures).toHaveLength(1);
    expect((await failures())[0]).toMatchObject({ actor: null, targetId: admin.id });
  });

  it("only shows the caller's organization", async () => {
    const foreignAdmin = await createUser(app, { permissions: ["user:manage"] });
    const foreignMember = await createUser(app, { sameOrganizationAs: foreignAdmin });
    await http()
      .post(`/v1/users/${foreignMember.id}/deactivate`)
      .set(await authHeader(app, foreignAdmin))
      .expect(200);

    const res = await http()
      .get("/v1/audit-logs")
      .set(await authHeader(app, admin))
      .expect(200);
    expect(res.body.total).toBe(0);
  });

  it("requires audit:read", async () => {
    await http().get("/v1/audit-logs").expect(401);
    const manager = await createUser(app, { permissions: ["user:manage"] });
    await http()
      .get("/v1/audit-logs")
      .set(await authHeader(app, manager))
      .expect(403);
  });
});
