import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import { HolidaysService } from "@/modules/holidays/holidays.service.js";

import {
  authHeader,
  createSchedule,
  createTestApp,
  createUser,
  PrismaService,
  resetDatabase,
  type TestUser,
} from "./helpers.js";

describe("Holidays and the work calendar (e2e)", () => {
  let app: NestExpressApplication;
  let hr: TestUser;

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    hr = await createUser(app, { permissions: ["holiday:manage"] });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const as = async (user: TestUser) => authHeader(app, user);
  const create = async (body: Record<string, unknown>) =>
    http()
      .post("/v1/holidays")
      .set(await as(hr))
      .send(body);

  it("requires holiday:manage", async () => {
    const reader = await createUser(app, {
      sameOrganizationAs: hr,
      permissions: ["policy:manage"],
    });
    await http()
      .get("/v1/holidays")
      .set(await as(reader))
      .expect(403);
  });

  it("creates, lists, renames and deletes a holiday, and records each change", async () => {
    const created = await create({ date: "2026-11-04", name: "Company Day" });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({
      id: expect.any(String),
      date: "2026-11-04",
      name: "Company Day",
      createdBy: { id: hr.id, name: expect.any(String) },
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    const id = created.body.id as string;
    const auth = await as(hr);

    await create({ date: "2026-12-25", name: "Christmas Day" });
    const list = await http()
      .get("/v1/holidays?from=2026-11-01&to=2026-11-30")
      .set(auth)
      .expect(200);
    expect(list.body.items.map((h: { name: string }) => h.name)).toEqual(["Company Day"]);

    await http().patch(`/v1/holidays/${id}`).set(auth).send({ date: "2026-11-05" }).expect(200);
    await http().delete(`/v1/holidays/${id}`).set(auth).expect(204);
    await http().get(`/v1/holidays/${id}`).set(auth).expect(404);

    const audit = await app
      .get(PrismaService)
      .auditLog.findMany({ where: { targetId: id }, orderBy: { createdAt: "asc" } });
    expect(audit.map((entry) => [entry.action, entry.metadata])).toEqual([
      ["holiday.created", { date: "2026-11-04", past: false }],
      ["holiday.updated", { fields: ["date"], dateFrom: "2026-11-04", dateTo: "2026-11-05" }],
      ["holiday.deleted", { date: "2026-11-05" }],
    ]);
  });

  it("allows one active holiday per date, and the date again once it's deleted", async () => {
    const first = await create({ date: "2026-11-04", name: "Company Day" });
    const clash = await create({ date: "2026-11-04", name: "Other" });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe("HOLIDAY_DATE_CONFLICT");

    const moved = await create({ date: "2026-11-06", name: "Other" });
    const moveOnto = await http()
      .patch(`/v1/holidays/${moved.body.id}`)
      .set(await as(hr))
      .send({ date: "2026-11-04" });
    expect(moveOnto.status).toBe(409);

    await http()
      .delete(`/v1/holidays/${first.body.id}`)
      .set(await as(hr))
      .expect(204);
    expect((await create({ date: "2026-11-04", name: "Company Day" })).status).toBe(201);
  });

  it("lets only one of two parallel requests for the same date through", async () => {
    const auth = await as(hr);
    const results = await Promise.all(
      ["A", "B"].map((name) =>
        http().post("/v1/holidays").set(auth).send({ date: "2026-11-04", name }),
      ),
    );
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
  });

  it("records a holiday added for a past date", async () => {
    const res = await create({ date: "2026-10-28", name: "Late addition" });
    expect(res.status).toBe(201);
    const [entry] = await app
      .get(PrismaService)
      .auditLog.findMany({ where: { targetId: res.body.id } });
    expect(entry?.metadata).toEqual({ date: "2026-10-28", past: true });
  });

  it("returns 404 for a holiday in another organization", async () => {
    const other = await createUser(app, { permissions: ["holiday:manage"] });
    const foreign = await http()
      .post("/v1/holidays")
      .set(await as(other))
      .send({ date: "2026-11-04", name: "Theirs" })
      .expect(201);
    await http()
      .delete(`/v1/holidays/${foreign.body.id}`)
      .set(await as(hr))
      .expect(404);
  });

  describe("working days", () => {
    it("excludes weekends and active holidays (GET /v1/work-calendar)", async () => {
      await createSchedule(app, hr);
      await create({ date: "2026-11-04", name: "Company Day" });

      const res = await http()
        .get("/v1/work-calendar?from=2026-11-02&to=2026-11-08")
        .set(await as(hr))
        .expect(200);
      expect(
        res.body.items.map((d: { date: string; isWorkingDay: boolean; reason: string | null }) => [
          d.date,
          d.isWorkingDay,
          d.reason,
        ]),
      ).toEqual([
        ["2026-11-02", true, null],
        ["2026-11-03", true, null],
        ["2026-11-04", false, "holiday"],
        ["2026-11-05", true, null],
        ["2026-11-06", true, null],
        ["2026-11-07", false, "non_working_day"],
        ["2026-11-08", false, "non_working_day"],
      ]);
      expect(res.body.items[2].holiday).toEqual({ id: expect.any(String), name: "Company Day" });
    });

    it("has no working days before the first schedule", async () => {
      await createSchedule(app, hr);
      const day = await app.get(HolidaysService).isWorkingDay(hr.organizationId, "2026-01-02");
      expect(day).toMatchObject({ isWorkingDay: false, reason: "no_schedule", schedule: null });
    });

    it("uses the version in force on each date", async () => {
      await createSchedule(app, hr, { effectiveTo: "2026-11-06" });
      const saturdays = await app.get(PrismaService).workSchedule.create({
        data: {
          organizationId: hr.organizationId,
          createdById: hr.id,
          name: "Six days",
          timezone: "Asia/Jakarta",
          workingDays: [1, 2, 3, 4, 5, 6],
          startTime: new Date("1970-01-01T09:00:00Z"),
          endTime: new Date("1970-01-01T17:00:00Z"),
          toleranceMinutes: 15,
          checkInOpensAt: new Date("1970-01-01T08:00:00Z"),
          checkInClosesAt: new Date("1970-01-01T17:00:00Z"),
          checkOutDeadline: new Date("1970-01-01T23:59:59.999Z"),
          effectiveFrom: new Date("2026-11-07T00:00:00Z"),
        },
      });
      const holidays = app.get(HolidaysService);
      expect((await holidays.isWorkingDay(hr.organizationId, "2026-11-07")).schedule?.id).toBe(
        saturdays.id,
      );
      expect((await holidays.isWorkingDay(hr.organizationId, "2026-11-07")).isWorkingDay).toBe(
        true,
      );
      expect((await holidays.isWorkingDay(hr.organizationId, "2026-10-31")).isWorkingDay).toBe(
        false,
      );
    });

    it("limits the calendar range", async () => {
      await http()
        .get("/v1/work-calendar?from=2026-01-01&to=2026-03-31")
        .set(await as(hr))
        .expect(400);
    });
  });
});
