import { randomUUID } from "node:crypto";

import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import { PrismaService } from "@/infra/prisma/prisma.service.js";
import { IdempotencyRepository } from "@/modules/attendance/idempotency.repository.js";
import { AttendanceJobsProcessor } from "@/modules/attendance/jobs/attendance-jobs.processor.js";

import {
  authHeader,
  clockOf,
  createDivision,
  createEmployee,
  createSchedule,
  createTestApp,
  createUser,
  resetDatabase,
  waitForJobs,
  type TestUser,
} from "./helpers.js";

const wib = (date: string, time: string) => `${date}T${time}+07:00`;
const FRIDAY = "2026-10-30";

describe("Close-day (e2e)", () => {
  let app: NestExpressApplication;
  let hr: TestUser;
  let divisionId: string;

  beforeEach(async () => {
    app = await createTestApp(); // Monday 2 November 2026, 10:00 WIB
    await resetDatabase(app);
    hr = await createUser(app, { permissions: ["policy:manage", "holiday:manage"] });
    divisionId = (await createDivision(app, hr)).id;
    await createSchedule(app, hr);
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const rerun = async (date: string, status: number) =>
    http()
      .post("/v1/attendance/close-day")
      .set(await authHeader(app, hr))
      .send({ date })
      .expect(status);

  const anEmployee = async (options: { inactive?: boolean; start?: string; end?: string } = {}) => {
    const user = await createUser(app, {
      sameOrganizationAs: hr,
      permissions: ["attendance:self"],
    });
    const employee = await createEmployee(app, hr, {
      divisionId,
      userId: user.id,
      inactive: options.inactive,
    });
    if (options.start || options.end) {
      await prisma().employee.update({
        where: { id: employee.id },
        data: {
          ...(options.start && { employmentStartDate: new Date(`${options.start}T00:00:00Z`) }),
          ...(options.end && { employmentEndDate: new Date(`${options.end}T00:00:00Z`) }),
        },
      });
    }
    return { employee, auth: await authHeader(app, user) };
  };
  const checkIn = (auth: { Authorization: string }) =>
    http().post("/v1/attendance/check-in").set(auth).set("Idempotency-Key", randomUUID());
  const recordsOn = (date: string) =>
    prisma().attendance.findMany({ where: { workDate: new Date(`${date}T00:00:00Z`) } });

  /** Friday: one complete, one open (no check-out), one who never checked in, and three not eligible. */
  const friday = async () => {
    const complete = await anEmployee();
    const open = await anEmployee();
    const missing = await anEmployee();
    const inactive = await anEmployee({ inactive: true });
    const left = await anEmployee({ end: "2026-10-29" });
    const notStarted = await anEmployee({ start: "2026-11-02" });

    clockOf(app).set(wib(FRIDAY, "09:00:00"));
    await checkIn(complete.auth).expect(201);
    await checkIn(open.auth).expect(201);
    clockOf(app).set(wib(FRIDAY, "17:00:00"));
    await http()
      .post("/v1/attendance/check-out")
      .set(complete.auth)
      .set("Idempotency-Key", randomUUID())
      .expect(200);
    clockOf(app).set(wib("2026-11-02", "10:00:00"));
    return { complete, open, missing, inactive, left, notStarted };
  };

  describe("re-run (POST /v1/attendance/close-day)", () => {
    it("marks only eligible employees without a record absent, once", async () => {
      const { open, missing } = await friday();

      const first = await rerun(FRIDAY, 200);
      expect(first.body).toEqual({
        runId: expect.stringMatching(/^cd-/),
        workDate: FRIDAY,
        isWorkingDay: true,
        reason: null,
        created: 1,
        skipped: 2,
        failed: 0,
      });

      const records = await recordsOn(FRIDAY);
      expect(records).toHaveLength(3);
      const absent = records.find((r) => r.employeeId === missing.employee.id);
      expect(absent).toMatchObject({
        status: "absent",
        completion: "not_applicable",
        source: "close_day_job",
        checkInAt: null,
        lateMinutes: 0,
        closeDayRunId: first.body.runId,
        scheduleTimezone: "Asia/Jakarta",
      });
      expect(absent?.onTimeDeadlineAt.toISOString()).toBe("2026-10-30T02:15:00.000Z");
      // Open records stay open
      expect(records.find((r) => r.employeeId === open.employee.id)).toMatchObject({
        status: "present",
        completion: "open",
        checkOutAt: null,
      });

      // The same result again, and nothing changes
      const before = records.map((r) => [r.id, r.version, r.updatedAt.getTime()]);
      const second = await rerun(FRIDAY, 200);
      expect(second.body).toMatchObject({ created: 0, skipped: 3, failed: 0 });
      const after = (await recordsOn(FRIDAY)).map((r) => [r.id, r.version, r.updatedAt.getTime()]);
      expect(after).toEqual(before);
    });

    it("skips weekends and holidays", async () => {
      await anEmployee();
      const saturday = await rerun("2026-10-31", 200);
      expect(saturday.body).toMatchObject({
        isWorkingDay: false,
        reason: "non_working_day",
        created: 0,
      });

      await http()
        .post("/v1/holidays")
        .set(await authHeader(app, hr))
        .send({ date: FRIDAY, name: "Company Day" })
        .expect(201);
      const holiday = await rerun(FRIDAY, 200);
      expect(holiday.body).toMatchObject({ isWorkingDay: false, reason: "holiday", created: 0 });
      expect(await prisma().attendance.count()).toBe(0);
    });

    it("only closes dates that have ended", async () => {
      for (const date of ["2026-11-02", "2026-11-03"]) {
        const res = await rerun(date, 422);
        expect(res.body.error.code).toBe("CLOSE_DAY_DATE_NOT_ENDED");
      }
    });

    it("requires policy:manage and is audited", async () => {
      const { auth } = await anEmployee();
      await http().post("/v1/attendance/close-day").set(auth).send({ date: FRIDAY }).expect(403);

      const res = await rerun(FRIDAY, 200);
      const [entry] = await prisma().auditLog.findMany({
        where: { action: "attendance.close_day_rerun" },
      });
      expect(entry).toMatchObject({
        actorId: hr.id,
        targetType: "organization",
        targetId: hr.organizationId,
      });
      expect(entry?.metadata).toMatchObject({
        runId: res.body.runId,
        workDate: FRIDAY,
        created: 1,
      });
    });

    it("stays inside the organization", async () => {
      await friday();
      const other = await createUser(app, { permissions: ["policy:manage"] });
      await createSchedule(app, other);
      const foreign = await createEmployee(app, other);
      await rerun(FRIDAY, 200);
      expect((await recordsOn(FRIDAY)).some((r) => r.employeeId === foreign.id)).toBe(false);
    });
  });

  describe("scheduled run", () => {
    it("starts at 00:05 Jakarta time for the previous date, once", async () => {
      const { missing } = await friday();
      const processor = app.get(AttendanceJobsProcessor);

      // 00:04 on Saturday: Friday isn't due yet
      clockOf(app).set(wib("2026-10-31", "00:04:59"));
      expect(await processor.enqueueDue()).toEqual([]);

      clockOf(app).set(wib("2026-10-31", "00:05:00"));
      const first = await processor.enqueueDue();
      const again = await processor.enqueueDue(); // the next tick: same job id, dropped
      expect(first).toEqual(again);
      expect(first).toHaveLength(1);
      await waitForJobs(app);

      const absent = (await recordsOn(FRIDAY)).filter((r) => r.status === "absent");
      expect(absent.map((r) => r.employeeId)).toEqual([missing.employee.id]);

      const audit = await prisma().auditLog.findMany({
        where: { action: "attendance.marked_absent" },
      });
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({ actorId: null, targetId: hr.organizationId });
      expect(audit[0]?.metadata).toMatchObject({ workDate: FRIDAY, created: 1, skipped: 2 });
    });
  });

  it("purges expired idempotency records only", async () => {
    const { auth } = await anEmployee();
    await checkIn(auth).expect(201);
    const repo = app.get(IdempotencyRepository);
    expect(await repo.purgeExpired(new Date(wib("2026-11-03", "09:59:59")))).toBe(0);
    expect(await repo.purgeExpired(new Date(wib("2026-11-03", "10:00:00")))).toBe(1);
    expect(await prisma().attendance.count()).toBe(1);
  });
});
