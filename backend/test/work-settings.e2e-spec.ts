import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import { PrismaService } from "@/infra/prisma/prisma.service.js";

import {
  authHeader,
  clockOf,
  createSchedule,
  createTestApp,
  createUser,
  resetDatabase,
  type TestUser,
} from "./helpers.js";

// The clock is frozen at Monday 2 November 2026, 10:00 in Jakarta (helpers.DEFAULT_NOW)
const BASELINE = {
  name: "Default schedule",
  timezone: "Asia/Jakarta",
  workingDays: [1, 2, 3, 4, 5],
  startTime: "09:00",
  endTime: "17:00",
  toleranceMinutes: 15,
  checkInOpensAt: "08:00",
  checkInClosesAt: "17:00",
  checkOutDeadline: "23:59:59.999",
  effectiveFrom: "2026-11-03",
};

describe("Work settings and schedules (e2e)", () => {
  let app: NestExpressApplication;
  let hr: TestUser;

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    hr = await createUser(app, { permissions: ["policy:manage"] });
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const as = async (user: TestUser) => authHeader(app, user);
  const createVersion = async (body: Record<string, unknown> = {}) =>
    http()
      .post("/v1/work-schedules")
      .set(await as(hr))
      .send({ ...BASELINE, ...body });

  it("requires policy:manage", async () => {
    const employee = await createUser(app, {
      sameOrganizationAs: hr,
      permissions: ["attendance:self"],
    });
    for (const path of ["/v1/work-settings", "/v1/work-schedules"]) {
      await http()
        .get(path)
        .set(await as(employee))
        .expect(403);
    }
  });

  describe("settings", () => {
    it("uses the organization zone and today's work date before any schedule exists", async () => {
      const res = await http()
        .get("/v1/work-settings")
        .set(await as(hr))
        .expect(200);
      expect(res.body).toEqual({
        timezone: "Asia/Jakarta",
        supportContact: null,
        retentionYears: 5,
        checkInReminderEnabled: true,
        checkInReminderTime: "09:00",
        checkOutReminderEnabled: true,
        checkOutReminderTime: "18:00",
        workDate: "2026-11-02",
        earliestEffectiveFrom: "2026-11-03",
        currentSchedule: null,
      });
    });

    it("takes the work date from Jakarta, not UTC", async () => {
      await createSchedule(app, hr);
      // 17:30 UTC on 1 November is 00:30 on 2 November in Jakarta
      clockOf(app).set("2026-11-01T17:30:00.000Z");
      const res = await http()
        .get("/v1/work-settings")
        .set(await as(hr))
        .expect(200);
      expect(res.body).toMatchObject({
        workDate: "2026-11-02",
        currentSchedule: { state: "current" },
      });
    });

    it("updates the support contact and retention, and records it", async () => {
      const res = await http()
        .patch("/v1/work-settings")
        .set(await as(hr))
        .send({ supportContact: "hr@example.test", retentionYears: 7 })
        .expect(200);
      expect(res.body).toMatchObject({ supportContact: "hr@example.test", retentionYears: 7 });

      await http()
        .patch("/v1/work-settings")
        .set(await as(hr))
        .send({ retentionYears: 11 })
        .expect(400);
      await http()
        .patch("/v1/work-settings")
        .set(await as(hr))
        .send({ timezone: "Asia/Makassar" })
        .expect(400);

      const audit = await app
        .get(PrismaService)
        .auditLog.findMany({ where: { targetId: hr.organizationId } });
      expect(audit.map((entry) => [entry.action, entry.metadata])).toEqual([
        [
          "organization.settings_updated",
          {
            fields: ["supportContact", "retentionYears"],
            retentionYearsFrom: 5,
            retentionYearsTo: 7,
          },
        ],
      ]);
    });
  });

  describe("creating a version", () => {
    it("starts tomorrow, ends the current version, and leaves its policy untouched", async () => {
      const current = await createSchedule(app, hr);
      const prisma = app.get(PrismaService);
      const before = await prisma.workSchedule.findUniqueOrThrow({ where: { id: current.id } });

      const res = await createVersion({
        name: "Later start",
        startTime: "09:30",
        toleranceMinutes: 10,
      });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(String),
        name: "Later start",
        scope: "organization",
        timezone: "Asia/Jakarta",
        workingDays: [1, 2, 3, 4, 5],
        startTime: "09:30:00",
        endTime: "17:00:00",
        toleranceMinutes: 10,
        onTimeDeadline: "09:40:00",
        checkInOpensAt: "08:00:00",
        checkInClosesAt: "17:00:00",
        checkOutDeadline: "23:59:59.999",
        effectiveFrom: "2026-11-03",
        effectiveTo: null,
        state: "upcoming",
        createdBy: { id: hr.id, name: expect.any(String) },
        createdAt: expect.any(String),
      });

      const after = await prisma.workSchedule.findUniqueOrThrow({ where: { id: current.id } });
      expect(after.effectiveTo?.toISOString().slice(0, 10)).toBe("2026-11-02");
      const { effectiveTo: _a, updatedAt: _b, ...policyBefore } = before;
      const { effectiveTo: _c, updatedAt: _d, ...policyAfter } = after;
      expect(policyAfter).toEqual(policyBefore);

      const audit = await prisma.auditLog.findMany({ where: { targetId: res.body.id } });
      expect(audit.map((entry) => [entry.action, entry.metadata])).toEqual([
        [
          "work_schedule.created",
          { effectiveFrom: "2026-11-03", timezone: "Asia/Jakarta", previousScheduleId: current.id },
        ],
      ]);
    });

    it("can't take effect today or in the past", async () => {
      for (const effectiveFrom of ["2026-11-02", "2026-10-01"]) {
        const res = await createVersion({ effectiveFrom });
        expect(res.status).toBe(422);
        expect(res.body.error).toMatchObject({
          code: "SCHEDULE_EFFECTIVE_DATE_TOO_EARLY",
          details: { earliest: "2026-11-03" },
        });
      }
    });

    it("rejects a version starting on or before one that's already planned", async () => {
      await createSchedule(app, hr);
      expect((await createVersion({ effectiveFrom: "2026-11-10" })).status).toBe(201);
      for (const effectiveFrom of ["2026-11-10", "2026-11-05"]) {
        const res = await createVersion({ effectiveFrom });
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("SCHEDULE_PERIOD_OVERLAP");
      }
      // After it is fine: the planned version gets an end date
      expect((await createVersion({ effectiveFrom: "2026-11-20" })).status).toBe(201);
    });

    it("lets only one of two parallel requests for the same date through", async () => {
      await createSchedule(app, hr);
      const auth = await as(hr);
      const results = await Promise.all(
        [1, 2].map(() => http().post("/v1/work-schedules").set(auth).send(BASELINE)),
      );
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);

      const versions = await app.get(PrismaService).workSchedule.findMany({
        where: { organizationId: hr.organizationId },
        orderBy: { effectiveFrom: "asc" },
      });
      expect(
        versions.map((v) =>
          [v.effectiveFrom, v.effectiveTo].map((d) => d?.toISOString().slice(0, 10) ?? null),
        ),
      ).toEqual([
        ["2026-01-05", "2026-11-02"],
        ["2026-11-03", null],
      ]);
    });

    it("validates the zone, days, tolerance and the order of the times", async () => {
      const res = await createVersion({
        timezone: "+07:00",
        workingDays: [1, 1, 8],
        toleranceMinutes: 121,
      });
      expect(res.status).toBe(400);
      expect(Object.keys(res.body.error.details.fieldErrors).sort()).toEqual([
        "timezone",
        "toleranceMinutes",
        "workingDays",
      ]);

      const order = await createVersion({
        checkInOpensAt: "09:30",
        endTime: "09:00",
        checkOutDeadline: "16:00",
      });
      expect(order.status).toBe(400);
      expect(Object.keys(order.body.error.details.fieldErrors).sort()).toEqual([
        "checkInOpensAt",
        "checkOutDeadline",
        "endTime",
      ]);
    });

    it("switches the work date to the new zone when it takes effect", async () => {
      await createSchedule(app, hr);
      await createVersion({ timezone: "Asia/Makassar" }).then((r) => expect(r.status).toBe(201));
      // 16:30 UTC on 2 November: 23:30 on the 2nd in Jakarta, 00:30 on the 3rd in Makassar (UTC+8)
      clockOf(app).set("2026-11-02T16:30:00.000Z");
      const res = await http()
        .get("/v1/work-settings")
        .set(await as(hr))
        .expect(200);
      expect(res.body).toMatchObject({
        timezone: "Asia/Makassar",
        workDate: "2026-11-03",
        currentSchedule: { timezone: "Asia/Makassar" },
      });
    });
  });

  it("previews the baseline's boundaries without saving", async () => {
    const res = await http()
      .post("/v1/work-schedules/preview")
      .set(await as(hr))
      .send(BASELINE)
      .expect(200);
    expect(res.body.onTimeDeadline).toBe("09:15:00");
    expect(res.body.days).toHaveLength(7);
    expect(res.body.days[0]).toEqual({
      workDate: "2026-11-03",
      isScheduledWeekday: true,
      checkInOpensAt: "2026-11-03T01:00:00.000Z",
      scheduledStartAt: "2026-11-03T02:00:00.000Z",
      onTimeDeadlineAt: "2026-11-03T02:15:00.000Z",
      scheduledEndAt: "2026-11-03T10:00:00.000Z",
      checkInClosesAt: "2026-11-03T10:00:00.000Z",
      checkOutClosesAt: "2026-11-03T16:59:59.999Z",
    });
    // Saturday 7 and Sunday 8 November
    expect(res.body.days.map((d: { isScheduledWeekday: boolean }) => d.isScheduledWeekday)).toEqual(
      [true, true, true, true, false, false, true],
    );
    expect(await app.get(PrismaService).workSchedule.count()).toBe(0);
  });

  it("lists versions newest first and hides other organizations' versions", async () => {
    await createSchedule(app, hr);
    await createVersion();
    const list = await http()
      .get("/v1/work-schedules")
      .set(await as(hr))
      .expect(200);
    expect(
      list.body.items.map((v: { effectiveFrom: string; state: string }) => [
        v.effectiveFrom,
        v.state,
      ]),
    ).toEqual([
      ["2026-11-03", "upcoming"],
      ["2026-01-05", "current"],
    ]);

    const other = await createUser(app);
    const foreign = await createSchedule(app, other);
    await http()
      .get(`/v1/work-schedules/${foreign.id}`)
      .set(await as(hr))
      .expect(404);
  });
});
