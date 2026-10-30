import { randomUUID } from "node:crypto";

import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import { PrismaService } from "@/infra/prisma/prisma.service.js";

import {
  authHeader,
  clockOf,
  createDivision,
  createEmployee,
  createSchedule,
  createTestApp,
  createUser,
  resetDatabase,
  type TestUser,
} from "./helpers.js";

/** An instant from a Jakarta wall-clock time (UTC+7, no DST). */
const wib = (date: string, time: string) => `${date}T${time}+07:00`;
const MONDAY = "2026-11-02";

describe("Attendance (e2e)", () => {
  let app: NestExpressApplication;
  let admin: TestUser;
  let divisionId: string;

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    admin = await createUser(app, { permissions: ["holiday:manage", "policy:manage"] });
    divisionId = (await createDivision(app, admin)).id;
    await createSchedule(app, admin);
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const at = (date: string, time: string) => clockOf(app).set(wib(date, time));

  /** A user with attendance:self and an employee profile in admin's organization. */
  const anEmployee = async (options: { inactive?: boolean; organizationOf?: TestUser } = {}) => {
    const owner = options.organizationOf ?? admin;
    const user = await createUser(app, {
      sameOrganizationAs: owner,
      permissions: ["attendance:self"],
    });
    const division = options.organizationOf ? await createDivision(app, owner) : { id: divisionId };
    const employee = await createEmployee(app, owner, {
      divisionId: division.id,
      userId: user.id,
      inactive: options.inactive,
    });
    return { user, employee, auth: await authHeader(app, user) };
  };

  type Auth = { Authorization: string };
  const checkIn = (auth: Auth, key: string = randomUUID()) =>
    http().post("/v1/attendance/check-in").set(auth).set("Idempotency-Key", key);
  const checkOut = (auth: Auth, key: string = randomUUID()) =>
    http().post("/v1/attendance/check-out").set(auth).set("Idempotency-Key", key);

  describe("check-in status (§7.3)", () => {
    it.each([
      ["09:15:00", "present", 0],
      ["09:15:01", "late", 1],
      ["09:16:01", "late", 2],
    ] as const)("at %s is %s by %i minutes", async (time, status, lateMinutes) => {
      const { auth } = await anEmployee();
      at(MONDAY, time);
      const res = await checkIn(auth).expect(201);
      expect(res.body).toMatchObject({
        workDate: MONDAY,
        status,
        lateMinutes,
        completion: "open",
        incomplete: false,
        source: "self_service",
        checkInAt: new Date(wib(MONDAY, time)).toISOString(),
        checkOutAt: null,
        workedMinutes: null,
        corrected: false,
        schedule: {
          timezone: "Asia/Jakarta",
          onTimeDeadlineAt: "2026-11-02T02:15:00.000Z",
          checkOutClosesAt: "2026-11-02T16:59:59.999Z",
        },
      });
    });
  });

  describe("check-in window (§7.2, inclusive)", () => {
    it.each([
      ["07:59:59", 422, "CHECK_IN_TOO_EARLY"],
      ["08:00:00", 201, null],
      ["17:00:00", 201, null],
      ["17:00:01", 422, "CHECK_IN_WINDOW_CLOSED"],
    ] as const)("at %s → %i", async (time, status, code) => {
      const { auth } = await anEmployee();
      at(MONDAY, time);
      const res = await checkIn(auth).expect(status);
      if (code) expect(res.body.error.code).toBe(code);
    });

    it("uses the Jakarta work date at a UTC boundary (Scenario J)", async () => {
      const { auth } = await anEmployee();
      clockOf(app).set("2026-11-02T23:30:00.000Z"); // 06:30 on 3 November in Jakarta
      const res = await checkIn(auth).expect(422);
      expect(res.body.error).toMatchObject({
        code: "CHECK_IN_TOO_EARLY",
        details: { opensAt: "2026-11-03T01:00:00.000Z" },
      });
      const today = await http().get("/v1/attendance/today").set(auth).expect(200);
      expect(today.body).toMatchObject({ workDate: "2026-11-03", state: "before_window" });
    });
  });

  describe("working days (§6.3)", () => {
    it("rejects a weekend", async () => {
      const { auth } = await anEmployee();
      at("2026-11-07", "10:00:00");
      const res = await checkIn(auth).expect(422);
      expect(res.body.error).toMatchObject({
        code: "ATTENDANCE_NOT_WORKDAY",
        details: { reason: "non_working_day", holidayName: null },
      });
    });

    it("rejects a holiday", async () => {
      const { auth } = await anEmployee();
      await http()
        .post("/v1/holidays")
        .set(await authHeader(app, admin))
        .send({ date: MONDAY, name: "Company Day" })
        .expect(201);
      const res = await checkIn(auth).expect(422);
      expect(res.body.error).toMatchObject({
        code: "ATTENDANCE_NOT_WORKDAY",
        details: { reason: "holiday", holidayName: "Company Day" },
      });
    });
  });

  describe("check-out (§8)", () => {
    it("records the duration and keeps the status", async () => {
      const { auth } = await anEmployee();
      at(MONDAY, "09:20:00");
      await checkIn(auth).expect(201);
      at(MONDAY, "17:05:30");
      const res = await checkOut(auth).expect(200);
      expect(res.body).toMatchObject({
        status: "late",
        lateMinutes: 5,
        completion: "complete",
        checkOutAt: new Date(wib(MONDAY, "17:05:30")).toISOString(),
        workedMinutes: 465,
      });
    });

    it("is allowed at 23:59:59.999 and rejected after it", async () => {
      const early = await anEmployee();
      const late = await anEmployee();
      at(MONDAY, "09:00:00");
      await checkIn(early.auth).expect(201);
      await checkIn(late.auth).expect(201);

      at(MONDAY, "23:59:59.999");
      await checkOut(early.auth).expect(200);

      clockOf(app).set("2026-11-02T17:00:00.000Z"); // 00:00 on 3 November in Jakarta
      const res = await checkOut(late.auth).expect(422);
      expect(res.body.error).toMatchObject({
        code: "CHECK_OUT_WINDOW_CLOSED",
        details: { closedAt: "2026-11-02T16:59:59.999Z" },
      });
    });

    it("needs a check-in and only happens once", async () => {
      const { auth } = await anEmployee();
      const none = await checkOut(auth).expect(409);
      expect(none.body.error.code).toBe("ATTENDANCE_NOT_CHECKED_IN");

      await checkIn(auth).expect(201);
      const first = await checkOut(auth).expect(200);
      clockOf(app).advance(60_000);
      const again = await checkOut(auth).expect(409);
      expect(again.body.error.code).toBe("ATTENDANCE_ALREADY_CHECKED_OUT");

      const record = await http().get(`/v1/attendance/${first.body.id}`).set(auth).expect(200);
      expect(record.body.checkOutAt).toBe(first.body.checkOutAt);
    });
  });

  it("never takes the time, employee or status from the client", async () => {
    const { auth, employee } = await anEmployee();
    for (const body of [
      { checkInAt: "2026-11-02T01:00:00.000Z" },
      { employeeId: employee.id },
      { status: "present" },
    ]) {
      const res = await checkIn(auth).send(body).expect(400);
      expect(res.body.error.code).toBe("VALIDATION_FAILED");
    }
    expect(await app.get(PrismaService).attendance.count()).toBe(0);
  });

  describe("concurrency", () => {
    it("creates one row for parallel check-ins with different keys", async () => {
      const { auth } = await anEmployee();
      const results = await Promise.all([1, 2, 3].map(() => checkIn(auth)));
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409, 409]);
      expect(results.filter((r) => r.status === 409).map((r) => r.body.error.code)).toEqual([
        "ATTENDANCE_ALREADY_CHECKED_IN",
        "ATTENDANCE_ALREADY_CHECKED_IN",
      ]);
      expect(await app.get(PrismaService).attendance.count()).toBe(1);
    });

    it("keeps the first of parallel check-outs", async () => {
      const { auth } = await anEmployee();
      await checkIn(auth).expect(201);
      at(MONDAY, "17:00:00");
      const results = await Promise.all([1, 2].map(() => checkOut(auth)));
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([200, 409]);
      const row = await app.get(PrismaService).attendance.findFirstOrThrow();
      expect(row.checkOutAt?.toISOString()).toBe("2026-11-02T10:00:00.000Z");
      expect(row.version).toBe(2);
    });
  });

  describe("Idempotency-Key (§7.4)", () => {
    it("replays the first result for the same key", async () => {
      const { auth } = await anEmployee();
      const key = randomUUID();
      const first = await checkIn(auth, key).expect(201);
      expect(first.headers["idempotent-replayed"]).toBeUndefined();

      clockOf(app).advance(5 * 60_000);
      const replay = await checkIn(auth, key).expect(201);
      expect(replay.headers["idempotent-replayed"]).toBe("true");
      expect(replay.body).toEqual(first.body);
      expect(await app.get(PrismaService).attendance.count()).toBe(1);
    });

    it("gives parallel requests with the same key the same record", async () => {
      const { auth } = await anEmployee();
      const key = randomUUID();
      const results = await Promise.all([1, 2].map(() => checkIn(auth, key)));
      expect(results.map((r) => r.status)).toEqual([201, 201]);
      expect(results[0]?.body.id).toBe(results[1]?.body.id);
    });

    it("rejects the key for a different action or day", async () => {
      const { auth } = await anEmployee();
      const key = randomUUID();
      await checkIn(auth, key).expect(201);
      const otherAction = await checkOut(auth, key).expect(409);
      expect(otherAction.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");

      // Still within the key's 24 hours
      at("2026-11-03", "08:30:00");
      const otherDay = await checkIn(auth, key).expect(409);
      expect(otherDay.body.error.code).toBe("IDEMPOTENCY_KEY_REUSED");

      // After 24 hours the key is free again
      at("2026-11-04", "10:00:00");
      await checkIn(auth, key).expect(201);
    });

    it("frees the key when the attempt fails, so a later retry is evaluated again", async () => {
      const { auth } = await anEmployee();
      const key = randomUUID();
      at(MONDAY, "07:59:59");
      await checkIn(auth, key).expect(422);
      at(MONDAY, "08:00:00");
      await checkIn(auth, key).expect(201);
    });

    it("keeps keys per user", async () => {
      const a = await anEmployee();
      const b = await anEmployee();
      const key = randomUUID();
      const first = await checkIn(a.auth, key).expect(201);
      const second = await checkIn(b.auth, key).expect(201);
      expect(second.body.id).not.toBe(first.body.id);
    });

    it("is required", async () => {
      const { auth } = await anEmployee();
      for (const key of [undefined, "has spaces", "x".repeat(129)]) {
        const req = http().post("/v1/attendance/check-in").set(auth);
        const res = await (key === undefined ? req : req.set("Idempotency-Key", key)).expect(400);
        expect(res.body.error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
      }
    });
  });

  describe("eligibility (§4)", () => {
    it("rejects a user without an employee profile", async () => {
      const user = await createUser(app, {
        sameOrganizationAs: admin,
        permissions: ["attendance:self"],
      });
      const auth = await authHeader(app, user);
      const res = await checkIn(auth).expect(422);
      expect(res.body.error.code).toBe("EMPLOYEE_PROFILE_REQUIRED");

      const today = await http().get("/v1/attendance/today").set(auth).expect(200);
      expect(today.body).toMatchObject({ state: "no_profile", canCheckIn: false, employee: null });
    });

    it("rejects an inactive employee", async () => {
      const { auth } = await anEmployee({ inactive: true });
      const res = await checkIn(auth).expect(422);
      expect(res.body.error.code).toBe("EMPLOYEE_INACTIVE");
    });

    it("requires attendance:self", async () => {
      const outsider = await createUser(app, { sameOrganizationAs: admin });
      await http()
        .get("/v1/attendance/today")
        .set(await authHeader(app, outsider))
        .expect(403);
    });
  });

  describe("today (UX_FLOWS.md §7.2)", () => {
    it("walks through the day's states", async () => {
      const { auth } = await anEmployee();
      const state = async () =>
        (await http().get("/v1/attendance/today").set(auth).expect(200)).body;

      at(MONDAY, "07:30:00");
      expect(await state()).toMatchObject({
        state: "before_window",
        canCheckIn: false,
        serverTime: "2026-11-02T00:30:00.000Z",
        schedule: { checkInOpensAt: "2026-11-02T01:00:00.000Z" },
        record: null,
      });
      at(MONDAY, "08:30:00");
      expect(await state()).toMatchObject({ state: "ready_to_check_in", canCheckIn: true });
      await checkIn(auth).expect(201);
      expect(await state()).toMatchObject({
        state: "checked_in",
        canCheckIn: false,
        canCheckOut: true,
        record: { status: "present" },
      });
      await checkOut(auth).expect(200);
      expect(await state()).toMatchObject({ state: "checked_out", canCheckOut: false });
    });

    it("says when the window closed, and why a day isn't a working day", async () => {
      const { auth } = await anEmployee();
      at(MONDAY, "17:30:00");
      expect((await http().get("/v1/attendance/today").set(auth)).body.state).toBe("window_closed");

      at("2026-11-08", "10:00:00");
      expect((await http().get("/v1/attendance/today").set(auth)).body).toMatchObject({
        state: "non_working_day",
        nonWorkingReason: "non_working_day",
      });
    });
  });

  it("keeps the record's schedule snapshot when the schedule changes", async () => {
    const { auth } = await anEmployee();
    const created = await checkIn(auth).expect(201);
    // Starting tomorrow, the day starts at 10:00
    await http()
      .post("/v1/work-schedules")
      .set(await authHeader(app, admin))
      .send({
        name: "Later",
        timezone: "Asia/Jakarta",
        workingDays: [1, 2, 3, 4, 5],
        startTime: "10:00",
        endTime: "18:00",
        toleranceMinutes: 0,
        checkInOpensAt: "09:00",
        checkInClosesAt: "18:00",
        checkOutDeadline: "23:59:59.999",
        effectiveFrom: "2026-11-03",
      })
      .expect(201);
    const record = await http().get(`/v1/attendance/${created.body.id}`).set(auth).expect(200);
    expect(record.body.schedule).toEqual(created.body.schedule);

    at("2026-11-03", "10:00:00");
    const next = await checkIn(auth).expect(201);
    expect(next.body).toMatchObject({
      status: "present",
      schedule: { onTimeDeadlineAt: "2026-11-03T03:00:00.000Z" },
    });
  });

  describe("history and summary", () => {
    it("lists own records newest first and sums them", async () => {
      const { auth } = await anEmployee();
      at(MONDAY, "09:00:00");
      await checkIn(auth).expect(201);
      at(MONDAY, "17:00:00");
      await checkOut(auth).expect(200);
      at("2026-11-03", "09:20:00");
      await checkIn(auth).expect(201); // late, never checked out
      at("2026-11-04", "09:10:00");
      await checkIn(auth).expect(201); // still open today

      const list = await http().get("/v1/attendance/me").set(auth).expect(200);
      expect(
        list.body.items.map((r: { workDate: string; incomplete: boolean }) => [
          r.workDate,
          r.incomplete,
        ]),
      ).toEqual([
        ["2026-11-04", false],
        ["2026-11-03", true],
        ["2026-11-02", false],
      ]);
      const late = await http().get("/v1/attendance/me?status=late").set(auth).expect(200);
      expect(late.body.total).toBe(1);
      const incomplete = await http()
        .get("/v1/attendance/me?incomplete=true")
        .set(auth)
        .expect(200);
      expect(incomplete.body.items.map((r: { workDate: string }) => r.workDate)).toEqual([
        "2026-11-03",
      ]);
      await http().get("/v1/attendance/me?incomplete=yes").set(auth).expect(400);

      const summary = await http()
        .get("/v1/attendance/me/summary?month=2026-11")
        .set(auth)
        .expect(200);
      expect(summary.body).toEqual({
        from: "2026-11-01",
        to: "2026-11-30",
        records: 3,
        present: 2,
        late: 1,
        attended: 3,
        absent: 0,
        excused: 0,
        complete: 1,
        open: 1,
        incomplete: 1,
        workedMinutes: 480,
        lateMinutes: 5,
      });
    });

    it("validates ranges", async () => {
      const { auth } = await anEmployee();
      await http().get("/v1/attendance/me/summary").set(auth).expect(400);
      await http().get("/v1/attendance/me/summary?from=2026-11-01").set(auth).expect(400);
      await http().get("/v1/attendance/me?from=2026-11-05&to=2026-11-01").set(auth).expect(400);
      await http().get("/v1/attendance/me?from=2025-01-01&to=2026-11-01").set(auth).expect(400);
    });

    it("returns 404 for someone else's record, in or outside the organization", async () => {
      const mine = await anEmployee();
      const colleague = await anEmployee();
      const otherOrg = await createUser(app, { permissions: ["policy:manage"] });
      await createSchedule(app, otherOrg);
      const foreigner = await anEmployee({ organizationOf: otherOrg });

      const colleagues = await checkIn(colleague.auth).expect(201);
      const foreign = await checkIn(foreigner.auth).expect(201);
      for (const id of [colleagues.body.id, foreign.body.id]) {
        await http().get(`/v1/attendance/${id}`).set(mine.auth).expect(404);
      }
    });
  });

  it("records check-ins and check-outs in the audit log", async () => {
    const { auth, user } = await anEmployee();
    at(MONDAY, "09:20:00");
    const created = await checkIn(auth).expect(201);
    at(MONDAY, "17:00:00");
    await checkOut(auth).expect(200);
    const audit = await app
      .get(PrismaService)
      .auditLog.findMany({ where: { targetId: created.body.id }, orderBy: { createdAt: "asc" } });
    expect(audit.map((e) => [e.action, e.actorId, e.metadata])).toEqual([
      ["attendance.checked_in", user.id, { workDate: MONDAY, status: "late", lateMinutes: 5 }],
      ["attendance.checked_out", user.id, { workDate: MONDAY, workedMinutes: 460 }],
    ]);
  });
});
