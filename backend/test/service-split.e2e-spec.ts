import { JwtService } from "@nestjs/jwt";
import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import { EmployeeServiceUnavailableError } from "@/common/contracts/rpc.js";
import type { AppConfig } from "@/config/config.module.js";
import { PrismaService as AttendanceDb } from "@/infra/attendance-db/prisma.service.js";
import { PrismaService as EmployeeDb } from "@/infra/employee-db/prisma.service.js";
import { EmployeeServiceClient } from "@/modules/directory/employee-service.client.js";
import { ReplicaRepository } from "@/modules/directory/replica.repository.js";
import { DirectoryPublisherService } from "@/modules/service-link/directory-publisher.service.js";

import {
  authHeader,
  createDivision,
  createEmployee,
  createSchedule,
  createTestApp,
  createUser,
  resetDatabase,
  waitForJobs,
} from "./helpers.js";

/** What only exists because there are two services: the wire between them. */
describe("Between the services (e2e)", () => {
  let app: NestExpressApplication;

  const http = () => request(app.getHttpServer());
  const replica = () => app.get(AttendanceDb);
  const source = () => app.get(EmployeeDb);

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("employee changes reach the attendance service", () => {
    const hr = async () => {
      const user = await createUser(app, {
        permissions: ["employee:manage", "division:manage", "report:read_all"],
      });
      return { user, auth: await authHeader(app, user) };
    };

    it("copies a new employee and every later change", async () => {
      const { user, auth } = await hr();
      const division = await createDivision(app, user);

      const created = await http()
        .post("/v1/employees")
        .set(auth)
        .send({
          employeeNumber: "EMP-777",
          fullName: "Original Name",
          workEmail: "original@example.test",
          divisionId: division.id,
          employmentStartDate: "2026-01-05",
        })
        .expect(201);
      const { id } = created.body as { id: string };
      expect(await replica().employee.findUniqueOrThrow({ where: { id } })).toMatchObject({
        employeeNumber: "EMP-777",
        fullName: "Original Name",
        status: "active",
      });

      await http()
        .patch(`/v1/employees/${id}`)
        .set(auth)
        .send({ fullName: "New Name" })
        .expect(200);
      expect((await replica().employee.findUniqueOrThrow({ where: { id } })).fullName).toBe(
        "New Name",
      );

      await http().post(`/v1/employees/${id}/deactivate`).set(auth).expect(200);
      expect((await replica().employee.findUniqueOrThrow({ where: { id } })).status).toBe(
        "inactive",
      );
    });

    it("copies a division created and renamed over the API", async () => {
      const { auth } = await hr();
      const { body } = await http()
        .post("/v1/divisions")
        .set(auth)
        .send({ code: "OPS", name: "Operations" })
        .expect(201);
      const { id } = body as { id: string };
      await http().patch(`/v1/divisions/${id}`).set(auth).send({ name: "Ops" }).expect(200);

      expect((await replica().division.findUniqueOrThrow({ where: { id } })).name).toBe("Ops");
    });

    it("ignores a message older than the row it already has", async () => {
      const user = await createUser(app);
      const employee = await createEmployee(app, user);
      const row = await replica().employee.findUniqueOrThrow({ where: { id: employee.id } });
      const repo = app.get(ReplicaRepository);
      const snapshot = (fullName: string, updatedAt: Date) => ({
        ...row,
        fullName,
        employmentStartDate: row.employmentStartDate.toISOString(),
        employmentEndDate: null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        deletedAt: null,
      });

      const newer = new Date(row.updatedAt.getTime() + 60_000);
      const older = new Date(row.updatedAt.getTime() + 30_000);
      expect(await repo.applyEmployee(snapshot("Newer", newer))).toBe(true);
      expect(await repo.applyEmployee(snapshot("Older", older))).toBe(false);

      expect(
        (await replica().employee.findUniqueOrThrow({ where: { id: employee.id } })).fullName,
      ).toBe("Newer");
    });

    it("a resync repairs a copy that lost a row", async () => {
      const user = await createUser(app);
      const employee = await createEmployee(app, user);
      await replica().employee.delete({ where: { id: employee.id } });

      await app.get(DirectoryPublisherService).resync();
      await waitForJobs(app);

      expect(
        await replica().employee.findUniqueOrThrow({ where: { id: employee.id } }),
      ).toMatchObject({ employeeNumber: employee.employeeNumber });
    });
  });

  describe("signing in, checked across TCP", () => {
    const today = "/v1/attendance/today";

    it("accepts a session the employee service knows", async () => {
      const user = await createUser(app, { permissions: ["attendance:self"] });
      await createEmployee(app, user, { userId: user.id });
      await createSchedule(app, user);

      await http()
        .get(today)
        .set(await authHeader(app, user))
        .expect(200);
    });

    it("keeps the expired-token code the frontend's refresh relies on", async () => {
      const user = await createUser(app, { permissions: ["attendance:self"] });
      const expired = await authHeader(app, user, { expiresIn: -10 });

      const fromEmployee = await http().get("/v1/auth/me").set(expired).expect(401);
      const fromAttendance = await http().get(today).set(expired).expect(401);

      const codeOf = (body: unknown) => (body as { error: { code: string } }).error.code;
      expect(codeOf(fromAttendance.body)).toBe(codeOf(fromEmployee.body));
      expect(codeOf(fromAttendance.body)).not.toBe("UNAUTHENTICATED");
    });

    it("rejects a forged token", async () => {
      const token = await new JwtService({ secret: "x".repeat(32) }).signAsync({ sid: "nope" });
      await http().get(today).set("Authorization", `Bearer ${token}`).expect(401);
    });

    it("logging out ends access to the attendance service at once", async () => {
      const user = await createUser(app, { permissions: ["attendance:self"] });
      await createEmployee(app, user, { userId: user.id });
      await createSchedule(app, user);
      const auth = await authHeader(app, user);
      await http().get(today).set(auth).expect(200);

      await http().post("/v1/auth/logout").set(auth).expect(204);

      await http().get(today).set(auth).expect(401);
    });

    it("turns an employee service that can't be reached into a 503", async () => {
      const config = {
        get: (key: string) => (key === "EMPLOYEE_RPC_HOST" ? "127.0.0.1" : 1),
      } as unknown as AppConfig;
      const client = new EmployeeServiceClient(config);
      await expect(client.send("anything", {})).rejects.toBeInstanceOf(
        EmployeeServiceUnavailableError,
      );
      await client.onModuleDestroy();
    });
  });

  describe("the audit log", () => {
    it("records the attendance service's events, linked to the request", async () => {
      const user = await createUser(app, { permissions: ["holiday:manage"] });
      const res = await http()
        .post("/v1/holidays")
        .set(await authHeader(app, user))
        .set("x-request-id", "request-across-services")
        .send({ date: "2026-12-30", name: "Company Day" })
        .expect(201);

      const entry = await source().auditLog.findFirstOrThrow({
        where: { action: "holiday.created" },
      });
      expect(entry).toMatchObject({
        organizationId: user.organizationId,
        actorId: user.id,
        targetId: (res.body as { id: string }).id,
        requestId: "request-across-services",
      });
      expect(res.headers["x-request-id"]).toBe("request-across-services");
    });

    it("stores who created a holiday by name, read over TCP", async () => {
      const user = await createUser(app, { permissions: ["holiday:manage"] });
      const res = await http()
        .post("/v1/holidays")
        .set(await authHeader(app, user))
        .send({ date: "2026-12-31", name: "Year end" })
        .expect(201);
      const { createdBy } = res.body as { createdBy: { id: string; name: string } };
      expect(createdBy.id).toBe(user.id);
      expect(createdBy.name).toMatch(/^User /);
    });
  });
});

// Its own app and lifecycle: sign-up is off in the app above, and a second app closing
// while the first is still in use would take shared singletons with it.
describe("A newly registered organization (e2e)", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createTestApp([], { config: { REGISTRATION_ENABLED: true } });
  });

  afterAll(async () => {
    await app.close();
  });

  it("gets its settings row in the attendance service", async () => {
    await resetDatabase(app);
    const res = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({
        email: "owner@example.test",
        name: "Owner",
        password: "correct-horse-battery-staple",
        organizationName: "New Org",
      })
      .expect(201);
    const { accessToken } = res.body as { accessToken: string };

    const context = await request(app.getHttpServer())
      .get("/v1/me/context")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    expect((context.body as { organization: { name: string } }).organization.name).toBe("New Org");
  });
});
