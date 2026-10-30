import { randomUUID } from "node:crypto";

import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import type { Permission } from "@/common/types/auth.js";
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

const wib = (date: string, time: string) => `${date}T${time}+07:00`;
const MONDAY = "2026-11-02";
const TUESDAY = "2026-11-03";
const REASON = "Forgot to tap check-in, was online from 09:00.";

type Auth = { Authorization: string };
type Person = { user: TestUser; employee: { id: string }; auth: Auth };

describe("Corrections (e2e)", () => {
  let app: NestExpressApplication;
  let hr: Person; // correction:decide_all, with an own profile
  let manager: Person; // correction:decide_team
  let report: Person; // reports to manager
  let other: Person; // reports to nobody
  let divisionId: string;

  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const at = (date: string, time: string) => clockOf(app).set(wib(date, time));

  const person = async (
    owner: TestUser | null,
    permissions: Permission[],
    managerId?: string,
  ): Promise<Person> => {
    const user = await createUser(app, {
      permissions: ["attendance:self", "correction:submit", ...permissions],
      ...(owner && { sameOrganizationAs: owner }),
    });
    const employee = await createEmployee(app, user, { divisionId, userId: user.id, managerId });
    return { user, employee, auth: await authHeader(app, user) };
  };

  const checkIn = (who: Person) =>
    http().post("/v1/attendance/check-in").set(who.auth).set("Idempotency-Key", randomUUID());
  const checkOut = (who: Person) =>
    http().post("/v1/attendance/check-out").set(who.auth).set("Idempotency-Key", randomUUID());
  const submit = (who: Person, body: Record<string, unknown>) =>
    http()
      .post("/v1/correction-requests")
      .set(who.auth)
      .send({ reason: REASON, ...body });
  const approve = (who: Person, id: string, body?: Record<string, unknown>) =>
    http().post(`/v1/correction-requests/${id}/approve`).set(who.auth).send(body);
  const reject = (who: Person, id: string, note = "No evidence of work before 10:00.") =>
    http().post(`/v1/correction-requests/${id}/reject`).set(who.auth).send({ decisionNote: note });
  const record = (id: string) => prisma().attendance.findUniqueOrThrow({ where: { id } });

  /** Monday: check in late at 09:30 and never check out (open, then incomplete). */
  const openMonday = async (who: Person): Promise<string> => {
    at(MONDAY, "09:30:00");
    const res = await checkIn(who).expect(201);
    return res.body.id as string;
  };

  /** Monday: no check-in; close-day makes it ABSENT. */
  const absentMonday = async (who: Person): Promise<string> => {
    at(TUESDAY, "10:00:00");
    await http().post("/v1/attendance/close-day").set(hr.auth).send({ date: MONDAY }).expect(200);
    const row = await prisma().attendance.findFirstOrThrow({
      where: { employeeId: who.employee.id, workDate: new Date(`${MONDAY}T00:00:00Z`) },
    });
    return row.id;
  };

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    const owner = await createUser(app);
    divisionId = (await createDivision(app, owner)).id;
    await createSchedule(app, owner);
    hr = await person(owner, ["correction:decide_all", "policy:manage"]);
    manager = await person(owner, ["correction:decide_team"]);
    report = await person(owner, [], manager.employee.id);
    other = await person(owner, []);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("approve and reject (§11.5)", () => {
    it("approve applies the times once and recalculates the record", async () => {
      const attendanceId = await openMonday(report);
      at(TUESDAY, "10:00:00");
      const submitted = await submit(report, {
        attendanceId,
        requestedCheckInAt: wib(MONDAY, "09:00:00"),
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(201);
      expect(submitted.body).toMatchObject({
        status: "pending",
        workDate: MONDAY,
        current: { checkInAt: "2026-11-02T02:30:00.000Z", checkOutAt: null },
        requested: {
          checkInAt: "2026-11-02T02:00:00.000Z",
          checkOutAt: "2026-11-02T10:00:00.000Z",
        },
        changes: ["check_in", "check_out"],
        timezone: "Asia/Jakarta",
        outcome: {
          current: { status: "late", lateMinutes: 15, workedMinutes: null },
          requested: { status: "present", lateMinutes: 0, workedMinutes: 480 },
        },
        requestedBy: { id: report.user.id },
        decision: null,
        canDecide: false,
      });

      // The record shows the pending request
      const pending = await http()
        .get(`/v1/attendance/${attendanceId}`)
        .set(report.auth)
        .expect(200);
      expect(pending.body).toMatchObject({
        pendingCorrectionId: submitted.body.id,
        corrected: false,
      });

      at(TUESDAY, "11:00:00");
      const approved = await approve(manager, submitted.body.id).expect(200);
      expect(approved.body).toMatchObject({
        status: "approved",
        decision: { decidedBy: { id: manager.user.id }, note: null },
        canDecide: false,
      });

      expect(await record(attendanceId)).toMatchObject({
        status: "present",
        lateMinutes: 0,
        completion: "complete",
        workedMinutes: 480,
        checkInAt: new Date(wib(MONDAY, "09:00:00")),
        checkOutAt: new Date(wib(MONDAY, "17:00:00")),
        version: 2,
        correctedAt: new Date(wib(TUESDAY, "11:00:00")),
      });
      const after = await http().get(`/v1/attendance/${attendanceId}`).set(report.auth).expect(200);
      expect(after.body).toMatchObject({
        corrected: true,
        pendingCorrectionId: null,
        incomplete: false,
      });

      const snapshot = await prisma().correctionSnapshot.findUniqueOrThrow({
        where: { correctionRequestId: submitted.body.id },
      });
      expect(snapshot).toMatchObject({
        schemaVersion: 1,
        before: {
          status: "late",
          lateMinutes: 15,
          completion: "open",
          version: 1,
          checkOutAt: null,
        },
        after: {
          status: "present",
          lateMinutes: 0,
          completion: "complete",
          workedMinutes: 480,
          version: 2,
        },
      });

      // A second decision applies nothing
      await approve(hr, submitted.body.id).expect(409, /CORRECTION_ALREADY_DECIDED/);
      expect((await record(attendanceId)).version).toBe(2);

      const audit = await prisma().auditLog.findMany({
        where: { targetId: submitted.body.id },
        orderBy: { createdAt: "asc" },
      });
      expect(audit.map((entry) => [entry.action, entry.actorId])).toEqual([
        ["correction.submitted", report.user.id],
        ["correction.approved", manager.user.id],
      ]);
      expect(audit[1]).toMatchObject({ targetType: "correction_request" });
      expect(audit[1]?.metadata).toMatchObject({
        attendanceId,
        workDate: MONDAY,
        changes: ["check_in", "check_out"],
        statusFrom: "late",
        statusTo: "present",
      });
    });

    it("adds a forgotten check-in to an absent record (late, still open)", async () => {
      const attendanceId = await absentMonday(report);
      const submitted = await submit(report, {
        attendanceId,
        requestedCheckInAt: wib(MONDAY, "09:20:00"),
      }).expect(201);
      expect(submitted.body.changes).toEqual(["check_in"]);

      await approve(hr, submitted.body.id, {
        decisionNote: "Confirmed with the team lead.",
      }).expect(200);
      expect(await record(attendanceId)).toMatchObject({
        status: "late",
        lateMinutes: 5,
        completion: "open",
        workedMinutes: null,
        source: "close_day_job",
      });
    });

    it("reject changes nothing and frees the record for a new request", async () => {
      const attendanceId = await openMonday(report);
      at(TUESDAY, "10:00:00");
      const before = await record(attendanceId);
      const submitted = await submit(report, {
        attendanceId,
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(201);

      await http()
        .post(`/v1/correction-requests/${submitted.body.id}/reject`)
        .set(manager.auth)
        .send({ decisionNote: "too short" })
        .expect(400);
      await http()
        .post(`/v1/correction-requests/${submitted.body.id}/reject`)
        .set(manager.auth)
        .send({})
        .expect(400);
      const rejected = await reject(manager, submitted.body.id).expect(200);
      expect(rejected.body).toMatchObject({
        status: "rejected",
        decision: { decidedBy: { id: manager.user.id }, note: "No evidence of work before 10:00." },
      });

      expect(await record(attendanceId)).toEqual(before);
      expect(
        await prisma().correctionSnapshot.count({
          where: { correctionRequestId: submitted.body.id },
        }),
      ).toBe(0);
      await approve(manager, submitted.body.id).expect(409, /CORRECTION_ALREADY_DECIDED/);
      await submit(report, { attendanceId, requestedCheckOutAt: wib(MONDAY, "17:00:00") }).expect(
        201,
      );
    });

    it.each([
      ["approve vs approve", "approve"],
      ["approve vs reject", "reject"],
    ] as const)("lets exactly one of two concurrent decisions win (%s)", async (_name, second) => {
      const attendanceId = await openMonday(report);
      at(TUESDAY, "10:00:00");
      const submitted = await submit(report, {
        attendanceId,
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(201);
      const id = submitted.body.id as string;

      const results = await Promise.all([
        approve(manager, id),
        second === "approve" ? approve(hr, id) : reject(hr, id),
      ]);
      expect(results.map((res) => res.status).sort((a, b) => a - b)).toEqual([200, 409]);
      expect(results.find((res) => res.status === 409)?.body.error.code).toBe(
        "CORRECTION_ALREADY_DECIDED",
      );

      const winner = results.findIndex((res) => res.status === 200);
      const approved = winner === 0 || second === "approve";
      expect((await record(attendanceId)).version).toBe(approved ? 2 : 1);
      expect(await prisma().correctionSnapshot.count()).toBe(approved ? 1 : 0);
      const decisions = await prisma().auditLog.count({
        where: { targetId: id, action: { in: ["correction.approved", "correction.rejected"] } },
      });
      expect(decisions).toBe(1);
    });

    it("blocks approval when the record changed after submission", async () => {
      const attendanceId = await openMonday(report);
      at(MONDAY, "12:00:00");
      const submitted = await submit(report, {
        attendanceId,
        requestedCheckInAt: wib(MONDAY, "09:00:00"),
      }).expect(201);
      at(MONDAY, "17:00:00");
      await checkOut(report).expect(200); // version 1 → 2

      at(TUESDAY, "09:00:00");
      await approve(manager, submitted.body.id).expect(409, /CORRECTION_VERSION_CONFLICT/);
      expect(await record(attendanceId)).toMatchObject({
        version: 2,
        status: "late",
        correctedAt: null,
      });
      // Nothing was decided: it stays pending until someone rejects it
      const detail = await http()
        .get(`/v1/correction-requests/${submitted.body.id}`)
        .set(manager.auth)
        .expect(200);
      expect(detail.body).toMatchObject({ status: "pending", canDecide: true });
      await reject(manager, submitted.body.id).expect(200);
    });
  });

  describe("who may decide (§11.4)", () => {
    it("never lets the requester decide their own request, whatever their role", async () => {
      const attendanceId = await openMonday(hr);
      at(TUESDAY, "10:00:00");
      const submitted = await submit(hr, {
        attendanceId,
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(201);

      await approve(hr, submitted.body.id).expect(403, /CORRECTION_SELF_APPROVAL_FORBIDDEN/);
      await reject(hr, submitted.body.id).expect(403, /CORRECTION_SELF_APPROVAL_FORBIDDEN/);
      const queue = await http().get("/v1/correction-requests").set(hr.auth).expect(200);
      expect(queue.body.total).toBe(0);

      // The database refuses it too
      await expect(
        prisma().correctionRequest.update({
          where: { id: submitted.body.id },
          data: {
            status: "approved",
            pendingAttendanceId: null,
            decidedById: hr.user.id,
            decidedAt: new Date(),
          },
        }),
      ).rejects.toThrow(/correction_requests_no_self_decision/);

      // Another Admin/HR can decide it
      const hr2 = await person(hr.user, ["correction:decide_all"]);
      await approve(hr2, submitted.body.id).expect(200);
    });

    it("scopes a manager to active direct reports (404 outside)", async () => {
      const reportRecord = await openMonday(report);
      const otherRecord = await openMonday(other);
      at(TUESDAY, "10:00:00");
      const fromReport = await submit(report, {
        attendanceId: reportRecord,
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(201);
      const fromOther = await submit(other, {
        attendanceId: otherRecord,
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(201);

      const queue = await http().get("/v1/correction-requests").set(manager.auth).expect(200);
      expect(queue.body.items.map((item: { id: string }) => item.id)).toEqual([fromReport.body.id]);
      expect(queue.body.items[0].canDecide).toBe(true);
      const filtered = await http()
        .get(`/v1/correction-requests?employeeId=${other.employee.id}`)
        .set(manager.auth)
        .expect(200);
      expect(filtered.body.total).toBe(0);

      await http()
        .get(`/v1/correction-requests/${fromOther.body.id}`)
        .set(manager.auth)
        .expect(404);
      await approve(manager, fromOther.body.id).expect(404);
      await reject(manager, fromOther.body.id).expect(404);

      // HR sees both, oldest first
      const all = await http().get("/v1/correction-requests").set(hr.auth).expect(200);
      expect(all.body.items.map((item: { id: string }) => item.id)).toEqual([
        fromReport.body.id,
        fromOther.body.id,
      ]);

      // A deactivated report leaves the manager's scope
      await prisma().employee.update({
        where: { id: report.employee.id },
        data: { status: "inactive" },
      });
      await approve(manager, fromReport.body.id).expect(404);
      expect(
        (await http().get("/v1/correction-requests").set(manager.auth).expect(200)).body.total,
      ).toBe(0);
    });

    it("needs a decide permission for the queue and decisions", async () => {
      const attendanceId = await openMonday(report);
      at(TUESDAY, "10:00:00");
      const submitted = await submit(report, {
        attendanceId,
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(201);

      await http().get("/v1/correction-requests").set(other.auth).expect(403);
      await approve(other, submitted.body.id).expect(404);
      // The requester can read their own request, not decide it
      await http().get(`/v1/correction-requests/${submitted.body.id}`).set(report.auth).expect(200);
      await approve(report, submitted.body.id).expect(403, /CORRECTION_SELF_APPROVAL_FORBIDDEN/);
    });

    it("hides other organizations' requests (404)", async () => {
      const attendanceId = await openMonday(report);
      at(TUESDAY, "10:00:00");
      const submitted = await submit(report, {
        attendanceId,
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(201);

      const outsider = await createUser(app, {
        permissions: ["correction:decide_all", "correction:submit", "attendance:self"],
      });
      const auth = await authHeader(app, outsider);
      await http().get(`/v1/correction-requests/${submitted.body.id}`).set(auth).expect(404);
      await http()
        .post(`/v1/correction-requests/${submitted.body.id}/approve`)
        .set(auth)
        .send({})
        .expect(404);
      expect((await http().get("/v1/correction-requests").set(auth).expect(200)).body.total).toBe(
        0,
      );
    });
  });

  describe("previewing", () => {
    it("shows what a proposal would do, without submitting it", async () => {
      const attendanceId = await openMonday(report);
      at(TUESDAY, "10:00:00");
      const preview = await http()
        .post("/v1/correction-requests/preview")
        .set(report.auth)
        .send({ attendanceId, requestedCheckOutAt: wib(MONDAY, "17:45:00") })
        .expect(200);
      expect(preview.body).toEqual({
        attendanceId,
        workDate: MONDAY,
        timezone: "Asia/Jakarta",
        submissionClosesAt: "2026-11-09T16:59:59.999Z",
        current: { checkInAt: "2026-11-02T02:30:00.000Z", checkOutAt: null },
        requested: {
          checkInAt: "2026-11-02T02:30:00.000Z",
          checkOutAt: "2026-11-02T10:45:00.000Z",
        },
        changes: ["check_out"],
        outcome: {
          current: { status: "late", lateMinutes: 15, workedMinutes: null },
          requested: { status: "late", lateMinutes: 15, workedMinutes: 495 },
        },
      });
      expect(await prisma().correctionRequest.count()).toBe(0);
    });

    it("applies submit's checks: own record, valid times", async () => {
      const attendanceId = await openMonday(report);
      at(TUESDAY, "10:00:00");
      await http()
        .post("/v1/correction-requests/preview")
        .set(other.auth)
        .send({ attendanceId, requestedCheckOutAt: wib(MONDAY, "17:00:00") })
        .expect(404);
      const invalid = await http()
        .post("/v1/correction-requests/preview")
        .set(report.auth)
        .send({ attendanceId, requestedCheckOutAt: wib(MONDAY, "08:00:00") })
        .expect(422);
      expect(invalid.body.error.code).toBe("CORRECTION_TIMES_INVALID");
      expect(invalid.body.error.details.fieldErrors).toHaveProperty("requestedCheckOutAt");
    });
  });

  describe("review queue filters", () => {
    it("narrows the queue to a division", async () => {
      const attendanceId = await openMonday(report);
      at(TUESDAY, "10:00:00");
      await submit(report, { attendanceId, requestedCheckOutAt: wib(MONDAY, "17:00:00") }).expect(
        201,
      );
      const inDivision = await http()
        .get(`/v1/correction-requests?divisionId=${divisionId}`)
        .set(hr.auth)
        .expect(200);
      expect(inDivision.body.total).toBe(1);
      const elsewhere = await http()
        .get(`/v1/correction-requests?divisionId=${randomUUID()}`)
        .set(hr.auth)
        .expect(200);
      expect(elsewhere.body.total).toBe(0);
    });
  });

  describe("submitting (§11.1–11.4)", () => {
    it("accepts day 7 at 23:59:59 and rejects day 8", async () => {
      const attendanceId = await openMonday(report);
      const body = { attendanceId, requestedCheckOutAt: wib(MONDAY, "17:00:00") };

      at("2026-11-10", "00:00:00");
      const late = await submit(report, body).expect(422);
      expect(late.body.error).toMatchObject({
        code: "CORRECTION_WINDOW_CLOSED",
        details: { closedAt: "2026-11-09T17:00:00.000Z" },
      });

      at("2026-11-09", "23:59:59");
      await submit(report, body).expect(201);
    });

    it("allows one pending request per record", async () => {
      const attendanceId = await openMonday(report);
      at(TUESDAY, "10:00:00");
      const body = { attendanceId, requestedCheckOutAt: wib(MONDAY, "17:00:00") };
      const results = await Promise.all([submit(report, body), submit(report, body)]);
      expect(results.map((res) => res.status).sort((a, b) => a - b)).toEqual([201, 409]);
      await submit(report, body).expect(409, /CORRECTION_ALREADY_PENDING/);
      expect(await prisma().correctionRequest.count()).toBe(1);
    });

    it("validates the reason and proposed times", async () => {
      const attendanceId = await openMonday(report);
      at(TUESDAY, "10:00:00");

      await submit(report, {
        attendanceId,
        reason: "   short   ",
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(400);
      await submit(report, {
        attendanceId,
        reason: "x".repeat(1001),
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(400);
      await submit(report, { attendanceId }).expect(400);
      await submit(report, {
        attendanceId,
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
        status: "present",
      }).expect(400);

      const before = await submit(report, {
        attendanceId,
        requestedCheckOutAt: wib(MONDAY, "09:00:00"),
      }).expect(422);
      expect(before.body.error).toMatchObject({
        code: "CORRECTION_TIMES_INVALID",
        details: { fieldErrors: { requestedCheckOutAt: ["Must be at or after the check-in"] } },
      });
      await submit(report, { attendanceId, requestedCheckOutAt: wib(TUESDAY, "01:00:00") }).expect(
        422,
        /CORRECTION_TIMES_INVALID/,
      );
      await submit(report, { attendanceId, requestedCheckInAt: wib(MONDAY, "09:30:00") }).expect(
        422,
        /Same as the current value/,
      );

      const absentId = await absentMonday(other);
      await submit(other, {
        attendanceId: absentId,
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(422, /no check-in/);

      // The reason is stored trimmed
      const ok = await submit(report, {
        attendanceId,
        reason: `  ${REASON}  `,
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(201);
      expect(ok.body.reason).toBe(REASON);
    });

    it("only targets your own records", async () => {
      const othersRecord = await openMonday(other);
      at(TUESDAY, "10:00:00");
      await submit(report, {
        attendanceId: othersRecord,
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(404);
      await submit(report, {
        attendanceId: randomUUID(),
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(404);

      const noProfile = await createUser(app, {
        sameOrganizationAs: hr.user,
        permissions: ["correction:submit"],
      });
      await http()
        .post("/v1/correction-requests")
        .set(await authHeader(app, noProfile))
        .send({
          attendanceId: othersRecord,
          reason: REASON,
          requestedCheckOutAt: wib(MONDAY, "17:00:00"),
        })
        .expect(422, /EMPLOYEE_PROFILE_REQUIRED/);

      const noPermission = await createUser(app, {
        sameOrganizationAs: hr.user,
        permissions: ["attendance:self"],
      });
      await http()
        .post("/v1/correction-requests")
        .set(await authHeader(app, noPermission))
        .send({
          attendanceId: othersRecord,
          reason: REASON,
          requestedCheckOutAt: wib(MONDAY, "17:00:00"),
        })
        .expect(403);
    });

    it("lists your own requests, newest first", async () => {
      const first = await openMonday(report);
      at(TUESDAY, "09:30:00");
      const second = (await checkIn(report).expect(201)).body.id as string;
      at("2026-11-04", "10:00:00");
      const a = await submit(report, {
        attendanceId: first,
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
      }).expect(201);
      at("2026-11-04", "10:05:00");
      const b = await submit(report, {
        attendanceId: second,
        requestedCheckOutAt: wib(TUESDAY, "17:00:00"),
      }).expect(201);
      await reject(manager, a.body.id).expect(200);

      const mine = await http().get("/v1/correction-requests/me").set(report.auth).expect(200);
      expect(mine.body.items.map((item: { id: string }) => item.id)).toEqual([
        b.body.id,
        a.body.id,
      ]);
      const pendingOnly = await http()
        .get("/v1/correction-requests/me?status=pending")
        .set(report.auth)
        .expect(200);
      expect(pendingOnly.body.items.map((item: { id: string }) => item.id)).toEqual([b.body.id]);
      const forFirst = await http()
        .get(`/v1/correction-requests/me?attendanceId=${first}`)
        .set(report.auth)
        .expect(200);
      expect(forFirst.body.items.map((item: { id: string }) => item.id)).toEqual([a.body.id]);
      expect(
        (await http().get("/v1/correction-requests/me").set(other.auth).expect(200)).body.total,
      ).toBe(0);
    });
  });
});
