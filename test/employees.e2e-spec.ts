import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import { PrismaService } from "@/infra/prisma/prisma.service.js";

import {
  authHeader,
  createDivision,
  createEmployee,
  createTestApp,
  createUser,
  resetDatabase,
  type TestUser,
} from "./helpers.js";

describe("Employees (e2e)", () => {
  let app: NestExpressApplication;
  let hr: TestUser;
  let divisionId: string;

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    hr = await createUser(app, { permissions: ["employee:manage", "user:read", "user:manage"] });
    divisionId = (await createDivision(app, hr)).id;
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const as = async (user: TestUser) => authHeader(app, user);
  const create = async (body: Record<string, unknown> = {}) =>
    http()
      .post("/v1/employees")
      .set(await as(hr))
      .send({
        employeeNumber: "emp-001",
        fullName: "Rina Wijaya",
        divisionId,
        employmentStartDate: "2026-01-05",
        ...body,
      });

  describe("access", () => {
    it("requires employee:manage", async () => {
      const manager = await createUser(app, {
        sameOrganizationAs: hr,
        permissions: ["attendance:read_team"],
      });
      await http()
        .get("/v1/employees")
        .set(await as(manager))
        .expect(403);
      await http()
        .post("/v1/employees")
        .set(await as(manager))
        .send({})
        .expect(403);
    });

    it("lists only the caller's organization and returns 404 for others", async () => {
      await createEmployee(app, hr, { divisionId });
      const other = await createUser(app);
      const foreign = await createEmployee(app, other);

      const list = await http()
        .get("/v1/employees")
        .set(await as(hr))
        .expect(200);
      expect(list.body.total).toBe(1);

      await http()
        .get(`/v1/employees/${foreign.id}`)
        .set(await as(hr))
        .expect(404);
      await http()
        .post(`/v1/employees/${foreign.id}/deactivate`)
        .set(await as(hr))
        .expect(404);
    });
  });

  describe("creating", () => {
    it("creates an employee without an account, uppercasing the number", async () => {
      const res = await create({ workEmail: "Rina@Example.test", jobTitle: "Manager" });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        employeeNumber: "EMP-001",
        fullName: "Rina Wijaya",
        workEmail: "rina@example.test",
        jobTitle: "Manager",
        status: "active",
        employmentStartDate: "2026-01-05",
        employmentEndDate: null,
        division: { id: divisionId, code: expect.any(String), name: expect.any(String) },
        manager: null,
        account: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it("rejects a number that's taken, even by an inactive employee", async () => {
      const first = await create();
      await http()
        .post(`/v1/employees/${first.body.id}/deactivate`)
        .set(await as(hr))
        .expect(200);
      const res = await create({ fullName: "Someone Else" });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("EMPLOYEE_NUMBER_TAKEN");
    });

    it("validates the number pattern and the employment period", async () => {
      const res = await create({
        employeeNumber: "-X",
        employmentStartDate: "2026-02-01",
        employmentEndDate: "2026-01-31",
      });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual([
        "employeeNumber",
        "employmentEndDate",
      ]);
    });

    it("rejects a division or manager from another organization, and an inactive division", async () => {
      const other = await createUser(app);
      const foreignDivision = await createDivision(app, other);
      const foreignManager = await createEmployee(app, other);

      expect((await create({ divisionId: foreignDivision.id })).status).toBe(404);
      expect((await create({ managerId: foreignManager.id })).status).toBe(404);

      const closed = await createDivision(app, hr, { inactive: true });
      const res = await create({ divisionId: closed.id });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("DIVISION_INACTIVE");
    });

    it("rejects an inactive manager", async () => {
      const former = await createEmployee(app, hr, { divisionId, inactive: true });
      const res = await create({ managerId: former.id });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe("MANAGER_INACTIVE");
    });
  });

  describe("reporting lines", () => {
    it("assigns a manager and records the change", async () => {
      const manager = await createEmployee(app, hr, { divisionId });
      const report = await createEmployee(app, hr, { divisionId });

      const res = await http()
        .patch(`/v1/employees/${report.id}`)
        .set(await as(hr))
        .send({ managerId: manager.id })
        .expect(200);
      expect(res.body.manager).toEqual({
        id: manager.id,
        employeeNumber: manager.employeeNumber,
        fullName: expect.any(String),
      });

      const team = await http()
        .get(`/v1/employees?managerId=${manager.id}`)
        .set(await as(hr))
        .expect(200);
      expect(team.body.items.map((e: { id: string }) => e.id)).toEqual([report.id]);

      const audit = await app
        .get(PrismaService)
        .auditLog.findMany({ where: { targetId: report.id }, orderBy: { createdAt: "asc" } });
      expect(audit.map((entry) => [entry.action, entry.metadata])).toEqual([
        ["employee.updated", { fields: ["managerId"] }],
        ["employee.manager_changed", { managerFrom: null, managerTo: manager.id }],
      ]);
    });

    it("rejects self-assignment and cycles", async () => {
      const top = await createEmployee(app, hr, { divisionId });
      const middle = await createEmployee(app, hr, { divisionId, managerId: top.id });
      const bottom = await createEmployee(app, hr, { divisionId, managerId: middle.id });

      for (const [id, managerId] of [
        [top.id, top.id],
        [top.id, middle.id],
        [top.id, bottom.id],
      ]) {
        const res = await http()
          .patch(`/v1/employees/${id}`)
          .set(await as(hr))
          .send({ managerId })
          .expect(422);
        expect(res.body.error.code).toBe("REPORTING_LINE_CYCLE");
      }

      // Removing a manager is always fine
      await http()
        .patch(`/v1/employees/${bottom.id}`)
        .set(await as(hr))
        .send({ managerId: null })
        .expect(200);
    });
  });

  describe("updating", () => {
    it("checks the period against the stored start date", async () => {
      const employee = await createEmployee(app, hr, { divisionId });
      const res = await http()
        .patch(`/v1/employees/${employee.id}`)
        .set(await as(hr))
        .send({ employmentEndDate: "2025-12-31" })
        .expect(422);
      expect(res.body.error.code).toBe("EMPLOYMENT_PERIOD_INVALID");
    });

    it("doesn't accept a new employee number", async () => {
      const employee = await createEmployee(app, hr, { divisionId });
      await http()
        .patch(`/v1/employees/${employee.id}`)
        .set(await as(hr))
        .send({ employeeNumber: "EMP-777" })
        .expect(400);
    });

    it("deactivates while keeping the profile readable", async () => {
      const employee = await createEmployee(app, hr, { divisionId });
      const res = await http()
        .post(`/v1/employees/${employee.id}/deactivate`)
        .set(await as(hr))
        .expect(200);
      expect(res.body.status).toBe("inactive");

      const active = await http()
        .get("/v1/employees?status=active")
        .set(await as(hr))
        .expect(200);
      expect(active.body.total).toBe(0);
      await http()
        .get(`/v1/employees/${employee.id}`)
        .set(await as(hr))
        .expect(200);
    });
  });

  describe("accounts", () => {
    it("invites a user for the employee", async () => {
      const employee = await createEmployee(app, hr, { divisionId });
      const res = await http()
        .post(`/v1/employees/${employee.id}/account`)
        .set(await as(hr))
        .send({ mode: "invite", email: "Rina@Example.test", roleId: hr.roleId })
        .expect(200);
      expect(res.body.account).toEqual({
        id: expect.any(String),
        email: "rina@example.test",
        role: { id: hr.roleId, name: expect.any(String) },
        status: "invited",
      });

      const again = await http()
        .post(`/v1/employees/${employee.id}/account`)
        .set(await as(hr))
        .send({ mode: "invite", email: "second@example.test", roleId: hr.roleId })
        .expect(409);
      expect(again.body.error.code).toBe("EMPLOYEE_HAS_ACCOUNT");
    });

    it("links an existing user and sets its role", async () => {
      const user = await createUser(app, { sameOrganizationAs: hr });
      const employeeRole = await createUser(app, {
        sameOrganizationAs: hr,
        permissions: ["attendance:self"],
      });
      const employee = await createEmployee(app, hr, { divisionId });

      const res = await http()
        .post(`/v1/employees/${employee.id}/account`)
        .set(await as(hr))
        .send({ mode: "link", userId: user.id, roleId: employeeRole.roleId })
        .expect(200);
      expect(res.body.account).toMatchObject({ id: user.id, role: { id: employeeRole.roleId } });

      // Linking the same user again changes nothing
      await http()
        .post(`/v1/employees/${employee.id}/account`)
        .set(await as(hr))
        .send({ mode: "link", userId: user.id })
        .expect(200);
    });

    it("won't link one user to two employees, or a user from another organization", async () => {
      const user = await createUser(app, { sameOrganizationAs: hr });
      await createEmployee(app, hr, { divisionId, userId: user.id });
      const second = await createEmployee(app, hr, { divisionId });

      const taken = await http()
        .post(`/v1/employees/${second.id}/account`)
        .set(await as(hr))
        .send({ mode: "link", userId: user.id })
        .expect(409);
      expect(taken.body.error.code).toBe("USER_HAS_EMPLOYEE");

      const foreign = await createUser(app);
      await http()
        .post(`/v1/employees/${second.id}/account`)
        .set(await as(hr))
        .send({ mode: "link", userId: foreign.id })
        .expect(404);
    });

    it("validates the fields each mode needs", async () => {
      const employee = await createEmployee(app, hr, { divisionId });
      const res = await http()
        .post(`/v1/employees/${employee.id}/account`)
        .set(await as(hr))
        .send({ mode: "invite", userId: hr.id })
        .expect(400);
      expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual([
        "email",
        "roleId",
        "userId",
      ]);
    });

    it("needs user:manage too", async () => {
      const hrWithoutUsers = await createUser(app, {
        sameOrganizationAs: hr,
        permissions: ["employee:manage"],
      });
      const employee = await createEmployee(app, hr, { divisionId });
      await http()
        .post(`/v1/employees/${employee.id}/account`)
        .set(await as(hrWithoutUsers))
        .send({ mode: "invite", email: "x@example.test", roleId: hr.roleId })
        .expect(403);
    });
  });

  describe("GET /v1/me/employee", () => {
    it("returns the caller's own profile, with no extra permission", async () => {
      const user = await createUser(app, { sameOrganizationAs: hr });
      const employee = await createEmployee(app, hr, { divisionId, userId: user.id });
      const res = await http()
        .get("/v1/me/employee")
        .set(await as(user))
        .expect(200);
      expect(res.body).toMatchObject({
        id: employee.id,
        account: { id: user.id, status: "active" },
      });
    });

    it("says when the user has no profile", async () => {
      const res = await http()
        .get("/v1/me/employee")
        .set(await as(hr))
        .expect(422);
      expect(res.body.error.code).toBe("EMPLOYEE_PROFILE_REQUIRED");
    });
  });
});
