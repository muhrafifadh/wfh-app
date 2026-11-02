import { randomUUID } from "node:crypto";

import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import type { Permission } from "@/common/types/auth.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import { StorageService } from "@/infra/storage/storage.service.js";
import { AttendanceVerificationService } from "@/modules/attendance-verification/attendance-verification.service.js";

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

// Selfie tests need the storage container: docker compose up -d storage

const wib = (date: string, time: string) => `${date}T${time}+07:00`;
const MONDAY = "2026-11-02";
const HOME = { latitude: -6.2615, longitude: 106.8106 };
/** About 3 km north of HOME. */
const ELSEWHERE = { latitude: -6.2345, longitude: 106.8106 };
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 60 }, () => 0x11)]);
const REASON = "Two documented cases of check-ins from outside the agreed home area.";

type Auth = { Authorization: string };

describe("Attendance verification (e2e)", () => {
  let app: NestExpressApplication;
  let admin: TestUser;
  let adminAuth: Auth;
  let divisionId: string;

  const start = async (options: { available?: boolean } = {}) => {
    app = await createTestApp([], {
      config: { VERIFICATION_ENABLED: options.available ?? true },
    });
    await resetDatabase(app);
    admin = await createUser(app, {
      permissions: [
        "verification:manage",
        "verification:read_photo",
        "attendance:read_all",
        "policy:manage",
      ],
    });
    adminAuth = await authHeader(app, admin);
    divisionId = (await createDivision(app, admin)).id;
    await createSchedule(app, admin);
  };

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const at = (date: string, time: string) => clockOf(app).set(wib(date, time));

  const aUser = async (permissions: Permission[], managerId?: string) => {
    const user = await createUser(app, { sameOrganizationAs: admin, permissions });
    const employee = await createEmployee(app, admin, { divisionId, userId: user.id, managerId });
    return { user, employee, auth: await authHeader(app, user) };
  };
  const anEmployee = (managerId?: string) =>
    aUser(["attendance:self", "correction:submit"], managerId);

  const enable = (body: { locationEnabled: boolean; selfieEnabled: boolean }) =>
    http()
      .patch("/v1/attendance-verification/settings")
      .set(adminAuth)
      .send({ ...body, justification: REASON });
  const checkIn = (auth: Auth) =>
    http().post("/v1/attendance/check-in").set(auth).set("Idempotency-Key", randomUUID());
  const mine = (auth: Auth) => http().get("/v1/attendance-verification/me").set(auth);
  const acknowledge = (auth: Auth) =>
    http().post("/v1/attendance-verification/notice/acknowledge").set(auth).expect(204);
  const share = (auth: Auth, reading: object) =>
    http().post("/v1/attendance-verification/location").set(auth).send(reading);

  /** An employee with an approved home area who has read the notice. */
  const readyEmployee = async (managerId?: string) => {
    const person = await anEmployee(managerId);
    await acknowledge(person.auth);
    await http()
      .post("/v1/attendance-verification/work-locations")
      .set(person.auth)
      .send({ label: "Home", ...HOME })
      .expect(201);
    const [pending] = (
      await http().get("/v1/attendance-verification/work-locations").set(adminAuth).expect(200)
    ).body.items as { id: string }[];
    await http()
      .post(`/v1/attendance-verification/work-locations/${pending?.id}/approve`)
      .set(adminAuth)
      .send({})
      .expect(200);
    return person;
  };

  const auditOf = () =>
    prisma().auditLog.findMany({
      where: { action: { startsWith: "attendance_verification." } },
      orderBy: { createdAt: "asc" },
    });

  describe("off by default", () => {
    beforeEach(() => start());

    it("changes nothing: no results at check-in, nothing to show, captures refused", async () => {
      const { auth } = await anEmployee();
      at(MONDAY, "09:00:00");
      await checkIn(auth).expect(201);

      expect(await prisma().attendanceVerification.count()).toBe(0);
      const me = await mine(auth).expect(200);
      expect(me.body).toMatchObject({
        location: { enabled: false, canSubmit: false },
        selfie: { enabled: false, canSubmit: false },
      });
      const res = await share(auth, { ...HOME, accuracyMeters: 10 }).expect(409);
      expect(res.body.error.code).toBe("VERIFICATION_DISABLED");
    });

    it("still rejects any body on check-in", async () => {
      const { auth } = await anEmployee();
      at(MONDAY, "09:00:00");
      await checkIn(auth).send({ latitude: 1 }).expect(400);
    });
  });

  describe("settings", () => {
    it("can't be turned on when the deployment switch is off", async () => {
      await start({ available: false });
      const res = await enable({ locationEnabled: true, selfieEnabled: false }).expect(409);
      expect(res.body.error.code).toBe("VERIFICATION_NOT_AVAILABLE");
    });

    it("treats a stored setting as off when the deployment switch is off", async () => {
      await start({ available: false });
      await prisma().organization.update({
        where: { id: admin.organizationId },
        data: { locationVerificationEnabled: true },
      });
      const { auth } = await anEmployee();
      expect((await mine(auth).expect(200)).body.location.enabled).toBe(false);
    });

    it("needs a recorded reason to turn a method on, and audits it", async () => {
      await start();
      const res = await http()
        .patch("/v1/attendance-verification/settings")
        .set(adminAuth)
        .send({ locationEnabled: true, selfieEnabled: false, justification: "because" })
        .expect(422);
      expect(res.body.error.code).toBe("VERIFICATION_JUSTIFICATION_REQUIRED");

      await enable({ locationEnabled: true, selfieEnabled: false }).expect(200);
      // Turning off needs no reason
      await http()
        .patch("/v1/attendance-verification/settings")
        .set(adminAuth)
        .send({ locationEnabled: false, selfieEnabled: false })
        .expect(200);

      const audit = await auditOf();
      expect(audit.map((entry) => entry.action)).toEqual([
        "attendance_verification.settings_changed",
        "attendance_verification.settings_changed",
      ]);
      expect(audit[0]?.metadata).toMatchObject({
        location: { from: false, to: true },
        justification: REASON,
      });
    });

    it("is for verification:manage only", async () => {
      await start();
      const { auth } = await aUser(["attendance:self", "attendance:read_all", "policy:manage"]);
      await http().get("/v1/attendance-verification/settings").set(auth).expect(403);
    });
  });

  describe("approved areas (decision V5)", () => {
    beforeEach(async () => {
      await start();
      await enable({ locationEnabled: true, selfieEnabled: false }).expect(200);
    });

    it("needs the notice first", async () => {
      const { auth } = await anEmployee();
      const res = await http()
        .post("/v1/attendance-verification/work-locations")
        .set(auth)
        .send({ label: "Home", ...HOME })
        .expect(409);
      expect(res.body.error.code).toBe("VERIFICATION_NOTICE_REQUIRED");
    });

    it("keeps the old area active until a change is approved, rounded to about 100 m", async () => {
      const { auth, employee } = await readyEmployee();
      await http()
        .post("/v1/attendance-verification/work-locations")
        .set(auth)
        .send({ label: "New flat", latitude: -6.123456, longitude: 106.654321 })
        .expect(201);

      const me = await mine(auth).expect(200);
      expect(me.body.workLocation).toEqual({
        approved: { label: "Home", radiusMeters: 1000 },
        pending: { label: "New flat" },
      });
      const stored = await prisma().workLocation.findFirstOrThrow({
        where: { employeeId: employee.id, status: "pending" },
      });
      expect([stored.latitude, stored.longitude]).toEqual([-6.123, 106.654]);
    });

    it("can't be approved by a manager, or decided twice", async () => {
      const { auth } = await anEmployee();
      await acknowledge(auth);
      await http()
        .post("/v1/attendance-verification/work-locations")
        .set(auth)
        .send({ label: "Home", ...HOME })
        .expect(201);
      const [pending] = (
        await http().get("/v1/attendance-verification/work-locations").set(adminAuth)
      ).body.items as { id: string }[];
      const manager = await aUser(["attendance:read_team", "correction:decide_team"]);

      await http()
        .post(`/v1/attendance-verification/work-locations/${pending?.id}/approve`)
        .set(manager.auth)
        .send({})
        .expect(403);
      await http()
        .post(`/v1/attendance-verification/work-locations/${pending?.id}/reject`)
        .set(adminAuth)
        .expect(200);
      const res = await http()
        .post(`/v1/attendance-verification/work-locations/${pending?.id}/approve`)
        .set(adminAuth)
        .send({})
        .expect(409);
      expect(res.body.error.code).toBe("WORK_LOCATION_ALREADY_DECIDED");
    });

    it("never puts the area's coordinates in the audit log", async () => {
      await readyEmployee();
      const audit = JSON.stringify(await auditOf());
      expect(audit).toContain("work_location_approved");
      expect(audit).not.toContain(String(HOME.latitude).slice(0, 5));
    });
  });

  describe("location at check-in (Phase 7A)", () => {
    beforeEach(async () => {
      await start();
      await enable({ locationEnabled: true, selfieEnabled: false }).expect(200);
    });

    it("verifies a reading inside the area and stores no coordinates", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      const attendance = await checkIn(auth).expect(201);

      const res = await share(auth, { ...HOME, accuracyMeters: 12.4 }).expect(200);
      expect(res.body.location).toMatchObject({ result: "verified", canSubmit: false });

      const row = await prisma().attendanceVerification.findFirstOrThrow();
      expect(row).toMatchObject({
        attendanceId: attendance.body.id,
        result: "verified",
        accuracyMeters: 12,
        distanceBand: "within_1km",
      });
      expect(JSON.stringify(row)).not.toContain("106.81");
      const audit = JSON.stringify(await auditOf());
      expect(audit).not.toContain("verified");
    });

    it("flags a reading outside the area, without touching attendance", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      const attendance = await checkIn(auth).expect(201);
      await share(auth, { ...ELSEWHERE, accuracyMeters: 20 }).expect(200);

      const list = await http()
        .get("/v1/attendance-verification?flagged=true")
        .set(adminAuth)
        .expect(200);
      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0]).toMatchObject({
        result: "outside_approved_area",
        flagged: true,
        diagnostics: { accuracyMeters: 20, distanceBand: "within_10km" },
      });
      const record = await prisma().attendance.findUniqueOrThrow({
        where: { id: attendance.body.id },
      });
      expect(record).toMatchObject({ status: "present", version: 1 });
    });

    it("shows low accuracy without a flag, and lets the employee retry later that day", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      await checkIn(auth).expect(201);
      const first = await share(auth, { ...ELSEWHERE, accuracyMeters: 2500 }).expect(200);
      expect(first.body.location).toMatchObject({ result: "low_accuracy", canSubmit: true });
      const flagged = await http()
        .get("/v1/attendance-verification?flagged=true")
        .set(adminAuth)
        .expect(200);
      expect(flagged.body.total).toBe(0);

      at(MONDAY, "13:00:00");
      const retry = await share(auth, { ...HOME, accuracyMeters: 30 }).expect(200);
      expect(retry.body.location.result).toBe("verified");
      const again = await share(auth, { ...HOME, accuracyMeters: 30 }).expect(409);
      expect(again.body.error.code).toBe("VERIFICATION_ALREADY_RECORDED");
    });

    it("keeps a neutral 'not shared' when nothing is shared within the capture window", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      await checkIn(auth).expect(201);
      expect((await mine(auth).expect(200)).body.location).toMatchObject({
        result: "not_shared",
        canSubmit: true,
      });

      at(MONDAY, "09:06:00");
      const res = await share(auth, { ...HOME, accuracyMeters: 10 }).expect(409);
      expect(res.body.error.code).toBe("VERIFICATION_WINDOW_CLOSED");
      const flagged = await http()
        .get("/v1/attendance-verification?flagged=true")
        .set(adminAuth)
        .expect(200);
      expect(flagged.body.total).toBe(0);
    });

    it("doesn't ask for a location without an approved area", async () => {
      const { auth } = await anEmployee();
      await acknowledge(auth);
      at(MONDAY, "09:00:00");
      await checkIn(auth).expect(201);
      const me = await mine(auth).expect(200);
      expect(me.body.location).toMatchObject({ result: "no_approved_area", canSubmit: false });
    });

    it("needs a check-in first", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      const res = await share(auth, { ...HOME, accuracyMeters: 10 }).expect(409);
      expect(res.body.error.code).toBe("ATTENDANCE_NOT_CHECKED_IN");
    });

    it("shows managers their direct reports' status only, without diagnostics", async () => {
      const managerUser = await aUser(["attendance:self", "attendance:read_team"]);
      const report = await readyEmployee(managerUser.employee.id);
      const other = await readyEmployee();
      at(MONDAY, "09:00:00");
      await checkIn(report.auth).expect(201);
      await checkIn(other.auth).expect(201);
      await share(report.auth, { ...ELSEWHERE, accuracyMeters: 20 }).expect(200);
      await share(other.auth, { ...ELSEWHERE, accuracyMeters: 20 }).expect(200);

      const res = await http().get("/v1/attendance-verification").set(managerUser.auth).expect(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        employee: { id: report.employee.id },
        flagged: true,
        diagnostics: null,
        photoAvailable: null,
      });
      const plain = await anEmployee();
      await http().get("/v1/attendance-verification").set(plain.auth).expect(403);
    });

    it("clears a flag once Admin/HR has reviewed it, and audits the review", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      await checkIn(auth).expect(201);
      await share(auth, { ...ELSEWHERE, accuracyMeters: 20 }).expect(200);
      const row = await prisma().attendanceVerification.findFirstOrThrow();

      const reviewed = await http()
        .post(`/v1/attendance-verification/${row.id}/review`)
        .set(adminAuth)
        .expect(200);
      expect(reviewed.body).toMatchObject({ flagged: false, result: "outside_approved_area" });
      expect((await auditOf()).map((entry) => entry.action)).toContain(
        "attendance_verification.reviewed",
      );
    });

    it("keeps other organizations' results out of reach", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      await checkIn(auth).expect(201);
      const row = await prisma().attendanceVerification.findFirstOrThrow();
      const outsider = await createUser(app, { permissions: ["verification:manage"] });
      await http()
        .post(`/v1/attendance-verification/${row.id}/review`)
        .set(await authHeader(app, outsider))
        .expect(404);
    });
  });

  describe("selfie at check-in (Phase 7B)", () => {
    beforeEach(async () => {
      await start();
      await enable({ locationEnabled: false, selfieEnabled: true }).expect(200);
    });

    const put = (url: string, headers: Record<string, string>, body: Buffer) =>
      fetch(url, { method: "PUT", headers, body: new Uint8Array(body) });

    const takeSelfie = async (auth: Auth, status: number, body: Buffer = JPEG) => {
      const upload = await http()
        .post("/v1/attendance-verification/selfie")
        .set(auth)
        .send({ contentType: "image/jpeg", size: body.length })
        .expect(201);
      expect((await put(upload.body.uploadUrl, upload.body.uploadHeaders, body)).ok).toBe(true);
      return http().post("/v1/attendance-verification/selfie/complete").set(auth).expect(status);
    };

    it("stores the photo apart from the uploads module, for Admin/HR with photo access only", async () => {
      const managerUser = await aUser(["attendance:self", "attendance:read_team"]);
      const { auth } = await anEmployee(managerUser.employee.id);
      await acknowledge(auth);
      at(MONDAY, "09:00:00");
      await checkIn(auth).expect(201);
      const done = await takeSelfie(auth, 200);
      expect(done.body.selfie).toMatchObject({ result: "captured", canSubmit: false });
      expect(await prisma().upload.count()).toBe(0);

      const row = await prisma().attendanceVerification.findFirstOrThrow();
      await http()
        .get(`/v1/attendance-verification/${row.id}/photo`)
        .set(managerUser.auth)
        .expect(403);
      const hrWithoutPhotos = await aUser(["verification:manage", "attendance:read_all"]);
      await http()
        .get(`/v1/attendance-verification/${row.id}/photo`)
        .set(hrWithoutPhotos.auth)
        .expect(403);

      const photo = await http()
        .get(`/v1/attendance-verification/${row.id}/photo`)
        .set(adminAuth)
        .expect(200);
      expect(Buffer.from(await (await fetch(photo.body.url)).arrayBuffer())).toEqual(JPEG);
      const viewed = (await auditOf()).filter(
        (entry) => entry.action === "attendance_verification.photo_viewed",
      );
      expect(viewed).toHaveLength(1);
      expect(viewed[0]).toMatchObject({ actorId: admin.id, targetId: row.id });
    });

    it("rejects a file that isn't the declared image, and allows a retake", async () => {
      const { auth } = await anEmployee();
      await acknowledge(auth);
      at(MONDAY, "09:00:00");
      await checkIn(auth).expect(201);
      const fake = Buffer.from("not a jpeg at all, just text pretending to be one");
      const res = await takeSelfie(auth, 422, fake);
      expect(res.body.error.code).toBe("UPLOAD_MISMATCH");
      await takeSelfie(auth, 200);
    });

    it("leaves attendance recorded when no photo is taken", async () => {
      const { auth } = await anEmployee();
      await acknowledge(auth);
      at(MONDAY, "09:00:00");
      await checkIn(auth).expect(201);
      at(MONDAY, "09:10:00");
      expect((await mine(auth).expect(200)).body.selfie).toMatchObject({
        result: "not_shared",
        canSubmit: false,
      });
      const res = await http()
        .post("/v1/attendance-verification/selfie")
        .set(auth)
        .send({ contentType: "image/jpeg", size: JPEG.length })
        .expect(409);
      expect(res.body.error.code).toBe("VERIFICATION_WINDOW_CLOSED");
      expect(await prisma().attendance.count()).toBe(1);
    });

    it("discloses an employee's own photo only after an identity check, audited", async () => {
      const { auth } = await anEmployee();
      await acknowledge(auth);
      at(MONDAY, "09:00:00");
      await checkIn(auth).expect(201);
      await takeSelfie(auth, 200);

      const results = await http()
        .get("/v1/attendance-verification/me/results")
        .set(auth)
        .expect(200);
      const [own] = results.body.items as { id: string; photoAvailable: boolean }[];
      expect(own).toMatchObject({ photoAvailable: true });

      const someoneElse = await anEmployee();
      await http()
        .post("/v1/attendance-verification/photo-requests")
        .set(someoneElse.auth)
        .send({ verificationId: own?.id })
        .expect(404);

      const requested = await http()
        .post("/v1/attendance-verification/photo-requests")
        .set(auth)
        .send({ verificationId: own?.id })
        .expect(201);
      await http()
        .post(`/v1/attendance-verification/photo-requests/${requested.body.id}/disclose`)
        .set(adminAuth)
        .send({})
        .expect(400);
      const disclosed = await http()
        .post(`/v1/attendance-verification/photo-requests/${requested.body.id}/disclose`)
        .set(adminAuth)
        .send({ identityCheck: "Video call, compared with HR file photo" })
        .expect(200);
      expect(disclosed.body.url).toMatch(/^http/);
      await http()
        .post(`/v1/attendance-verification/photo-requests/${requested.body.id}/disclose`)
        .set(adminAuth)
        .send({ identityCheck: "Video call, compared with HR file photo" })
        .expect(409);

      const actions = (await auditOf()).map((entry) => entry.action);
      expect(actions).toEqual(
        expect.arrayContaining([
          "attendance_verification.photo_requested",
          "attendance_verification.photo_disclosed",
        ]),
      );
    });

    it("deletes photos after 30 days and results after 90, leaving attendance alone", async () => {
      const { auth } = await anEmployee();
      await acknowledge(auth);
      at(MONDAY, "09:00:00");
      const attendance = await checkIn(auth).expect(201);
      await takeSelfie(auth, 200);
      const row = await prisma().attendanceVerification.findFirstOrThrow();
      const service = app.get(AttendanceVerificationService);

      await service.purgeExpired(new Date(wib("2026-12-01", "09:00:00")));
      expect((await prisma().attendanceVerification.findFirstOrThrow()).photoKey).not.toBeNull();

      await service.purgeExpired(new Date(wib("2026-12-03", "09:00:00")));
      const cleared = await prisma().attendanceVerification.findFirstOrThrow();
      expect(cleared.photoKey).toBeNull();
      expect(await app.get(StorageService).head(row.photoKey ?? "")).toBeNull();

      await service.purgeExpired(new Date(wib("2027-02-01", "09:00:00")));
      expect(await prisma().attendanceVerification.count()).toBe(0);
      expect(
        await prisma().attendance.findUniqueOrThrow({ where: { id: attendance.body.id } }),
      ).toMatchObject({ status: "present" });
    });
  });
});
