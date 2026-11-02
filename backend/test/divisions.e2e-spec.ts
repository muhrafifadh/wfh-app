import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import {
  authHeader,
  createDivision,
  createEmployee,
  createTestApp,
  createUser,
  PrismaService,
  resetDatabase,
  type TestUser,
} from "./helpers.js";

describe("Divisions (e2e)", () => {
  let app: NestExpressApplication;
  let hr: TestUser;

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    hr = await createUser(app, { permissions: ["division:manage"] });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const as = async (user: TestUser) => authHeader(app, user);

  it("requires division:manage", async () => {
    await http().get("/v1/divisions").expect(401);
    const employee = await createUser(app, {
      sameOrganizationAs: hr,
      permissions: ["attendance:self", "correction:submit"],
    });
    const res = await http()
      .get("/v1/divisions")
      .set(await as(employee))
      .expect(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("creates a division with an uppercased code and records it", async () => {
    const res = await http()
      .post("/v1/divisions")
      .set(await as(hr))
      .send({ code: " eng ", name: "Engineering" })
      .expect(201);
    expect(res.body).toEqual({
      id: expect.any(String),
      code: "ENG",
      name: "Engineering",
      status: "active",
      activeEmployeeCount: 0,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const audit = await app
      .get(PrismaService)
      .auditLog.findMany({ where: { targetId: res.body.id } });
    expect(audit.map((entry) => entry.action)).toEqual(["division.created"]);
  });

  it("rejects a duplicate code, and a duplicate name ignoring case", async () => {
    await createDivision(app, hr, { name: "Engineering" });
    const existing = await http()
      .get("/v1/divisions")
      .set(await as(hr))
      .expect(200);
    const code = existing.body.items[0].code as string;

    const byCode = await http()
      .post("/v1/divisions")
      .set(await as(hr))
      .send({ code, name: "Other" })
      .expect(409);
    expect(byCode.body.error.code).toBe("DIVISION_CODE_TAKEN");

    const byName = await http()
      .post("/v1/divisions")
      .set(await as(hr))
      .send({ code: "NEW", name: "ENGINEERING" })
      .expect(409);
    expect(byName.body.error.code).toBe("DIVISION_NAME_TAKEN");
  });

  it("allows the same code in another organization", async () => {
    const other = await createUser(app, { permissions: ["division:manage"] });
    for (const user of [hr, other]) {
      await http()
        .post("/v1/divisions")
        .set(await as(user))
        .send({ code: "ENG", name: "Engineering" })
        .expect(201);
    }
  });

  it("validates the code format", async () => {
    const res = await http()
      .post("/v1/divisions")
      .set(await as(hr))
      .send({ code: "e", name: "" })
      .expect(400);
    expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual(["code", "name"]);
  });

  it("returns 404 for a division in another organization", async () => {
    const other = await createUser(app);
    const foreign = await createDivision(app, other);
    await http()
      .get(`/v1/divisions/${foreign.id}`)
      .set(await as(hr))
      .expect(404);
    await http()
      .patch(`/v1/divisions/${foreign.id}`)
      .set(await as(hr))
      .send({ name: "Mine now" })
      .expect(404);
  });

  it("updates, deactivates and reactivates, and filters by status", async () => {
    const division = await createDivision(app, hr);
    const auth = await as(hr);

    const renamed = await http()
      .patch(`/v1/divisions/${division.id}`)
      .set(auth)
      .send({ name: "Platform" })
      .expect(200);
    expect(renamed.body.name).toBe("Platform");

    await http().post(`/v1/divisions/${division.id}/deactivate`).set(auth).expect(200);
    // Safe to repeat
    const again = await http()
      .post(`/v1/divisions/${division.id}/deactivate`)
      .set(auth)
      .expect(200);
    expect(again.body.status).toBe("inactive");

    const inactive = await http().get("/v1/divisions?status=inactive").set(auth).expect(200);
    expect(inactive.body.total).toBe(1);

    await http().post(`/v1/divisions/${division.id}/reactivate`).set(auth).expect(200);
    const audit = await app
      .get(PrismaService)
      .auditLog.findMany({ where: { targetId: division.id }, orderBy: { createdAt: "asc" } });
    expect(audit.map((entry) => entry.action)).toEqual([
      "division.updated",
      "division.deactivated",
      "division.reactivated",
    ]);
  });

  it("counts active employees and refuses to deactivate while any remain", async () => {
    const division = await createDivision(app, hr);
    const auth = await as(hr);
    const active = await createEmployee(app, hr, { divisionId: division.id });
    await createEmployee(app, hr, { divisionId: division.id, inactive: true });

    const listed = await http().get("/v1/divisions").set(auth).expect(200);
    expect(listed.body.items[0].activeEmployeeCount).toBe(1);

    const refused = await http()
      .post(`/v1/divisions/${division.id}/deactivate`)
      .set(auth)
      .expect(409);
    expect(refused.body.error).toMatchObject({
      code: "DIVISION_HAS_ACTIVE_EMPLOYEES",
      details: { activeEmployeeCount: 1 },
    });

    await app
      .get(PrismaService)
      .employee.update({ where: { id: active.id }, data: { status: "inactive" } });
    const done = await http().post(`/v1/divisions/${division.id}/deactivate`).set(auth).expect(200);
    expect(done.body).toMatchObject({ status: "inactive", activeEmployeeCount: 0 });
  });
});
