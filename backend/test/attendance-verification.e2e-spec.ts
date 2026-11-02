import { randomUUID } from "node:crypto";

import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import type { Permission } from "@/common/types/auth.js";
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
  PrismaService,
  resetDatabase,
  type TestUser,
} from "./helpers.js";

// Selfie tests need the storage container: docker compose up -d storage

const wib = (date: string, time: string) => `${date}T${time}+07:00`;
const MONDAY = "2026-11-02";
const HOME = { latitude: -6.2615, longitude: 106.8106 };
/** About 3 km north of HOME. */
const ELSEWHERE = { latitude: -6.2345, longitude: 106.8106 };
/** About 8 km north-east of HOME. */
const OFFICE = { latitude: -6.2088, longitude: 106.8456 };
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
  const record = (
    auth: Auth,
    moment: "check-in" | "check-out",
    body: object = {},
    key = randomUUID(),
  ) =>
    http()
      .post(`/v1/attendance-verification/${moment}`)
      .set(auth)
      .set("Idempotency-Key", key)
      .send(body);
  const uploadPhoto = async (auth: Auth, moment: "check_in" | "check_out", body: Buffer = JPEG) => {
    const upload = await http()
      .post("/v1/attendance-verification/photo-upload")
      .set(auth)
      .send({ moment, contentType: "image/jpeg", size: body.length })
      .expect(201);
    const put = await fetch(upload.body.uploadUrl, {
      method: "PUT",
      headers: upload.body.uploadHeaders,
      body: new Uint8Array(body),
    });
    expect(put.ok).toBe(true);
  };

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

    it("changes nothing: no results at check-in, nothing to show, evidence refused", async () => {
      const { auth } = await anEmployee();
      at(MONDAY, "09:00:00");
      await checkIn(auth).expect(201);

      expect(await prisma().attendanceVerification.count()).toBe(0);
      const me = await mine(auth).expect(200);
      expect(me.body).toMatchObject({ location: { enabled: false }, selfie: { enabled: false } });
      const res = await record(auth, "check-out", {
        location: { ...HOME, accuracyMeters: 10 },
      }).expect(409);
      expect(res.body.error.code).toBe("VERIFICATION_DISABLED");
    });

    it("still rejects any body on check-in", async () => {
      const { auth } = await anEmployee();
      at(MONDAY, "09:00:00");
      await checkIn(auth).send({ latitude: 1 }).expect(400);
    });

    it("leaves the plain endpoints working when the deployment switch overrides a stored setting", async () => {
      app = await createTestApp([], { config: { VERIFICATION_ENABLED: false } });
      await resetDatabase(app);
      admin = await createUser(app, { permissions: ["policy:manage"] });
      divisionId = (await createDivision(app, admin)).id;
      await createSchedule(app, admin);
      await prisma().organization.update({
        where: { id: admin.organizationId },
        data: { selfieVerificationEnabled: true },
      });
      const { auth } = await anEmployee();
      at(MONDAY, "09:00:00");
      await checkIn(auth).expect(201);
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

  describe("evidence is required", () => {
    beforeEach(async () => {
      await start();
      await enable({ locationEnabled: true, selfieEnabled: true }).expect(200);
    });

    const location = { location: { ...HOME, accuracyMeters: 12 } };

    it("refuses the plain endpoints, so nothing is recorded without evidence", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      const res = await checkIn(auth).expect(409);
      expect(res.body.error.code).toBe("VERIFICATION_REQUIRED");
      const out = await http()
        .post("/v1/attendance/check-out")
        .set(auth)
        .set("Idempotency-Key", randomUUID())
        .expect(409);
      expect(out.body.error.code).toBe("VERIFICATION_REQUIRED");
      expect(await prisma().attendance.count()).toBe(0);
    });

    it("needs the notice first", async () => {
      const { auth } = await anEmployee();
      at(MONDAY, "09:00:00");
      const res = await record(auth, "check-in", location).expect(409);
      expect(res.body.error.code).toBe("VERIFICATION_NOTICE_REQUIRED");
      expect(await prisma().attendance.count()).toBe(0);
    });

    it("records nothing without a photo", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      const res = await record(auth, "check-in", location).expect(409);
      expect(res.body.error.code).toBe("VERIFICATION_PHOTO_REQUIRED");
      expect(await prisma().attendance.count()).toBe(0);
    });

    it("records nothing without a location", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      await uploadPhoto(auth, "check_in");
      const res = await record(auth, "check-in").expect(409);
      expect(res.body.error.code).toBe("VERIFICATION_LOCATION_REQUIRED");
      expect(await prisma().attendance.count()).toBe(0);
    });

    it("rejects a file that isn't the declared image, and allows a retake", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      await uploadPhoto(auth, "check_in", Buffer.from("not a jpeg at all, just text pretending"));
      const res = await record(auth, "check-in", location).expect(422);
      expect(res.body.error.code).toBe("UPLOAD_MISMATCH");
      expect(await prisma().attendance.count()).toBe(0);

      await uploadPhoto(auth, "check_in");
      await record(auth, "check-in", location).expect(201);
    });

    it("records check-in and check-out, each with its own photo and location", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      await uploadPhoto(auth, "check_in");
      const attendance = await record(auth, "check-in", location).expect(201);
      expect(attendance.body.checkInAt).not.toBeNull();

      at(MONDAY, "17:00:00");
      // The check-in's photo can't stand in for the check-out's
      const missing = await record(auth, "check-out", location).expect(409);
      expect(missing.body.error.code).toBe("VERIFICATION_PHOTO_REQUIRED");
      await uploadPhoto(auth, "check_out");
      const out = await record(auth, "check-out", {
        location: { ...ELSEWHERE, accuracyMeters: 20 },
      }).expect(200);
      expect(out.body.checkOutAt).not.toBeNull();

      const rows = await prisma().attendanceVerification.findMany({
        where: { attendanceId: attendance.body.id },
      });
      expect(
        rows.map(({ moment, method, result }) => `${moment} ${method} ${result}`).toSorted(),
      ).toEqual([
        "check_in location verified",
        "check_in selfie captured",
        "check_out location outside_approved_area",
        "check_out selfie captured",
      ]);
      expect(await prisma().verificationPendingPhoto.count()).toBe(0);
      expect((await mine(auth).expect(200)).body.results).toHaveLength(4);

      // Each photo downloads under a name that says which one it is
      for (const [moment, name] of [
        ["check_in", "check-in-photo-2026-11-02"],
        ["check_out", "check-out-photo-2026-11-02"],
      ] as const) {
        const photo = rows.find((row) => row.moment === moment && row.method === "selfie");
        const link = await http()
          .get(`/v1/attendance-verification/${photo?.id}/photo`)
          .set(adminAuth)
          .expect(200);
        expect(link.body.url).toContain(name);
      }
    });

    it("replays a retry with the same key, with no second result", async () => {
      const { auth } = await readyEmployee();
      const key = randomUUID();
      at(MONDAY, "09:00:00");
      await uploadPhoto(auth, "check_in");
      const first = await record(auth, "check-in", location, key).expect(201);
      const again = await record(auth, "check-in", location, key).expect(201);
      expect(again.headers["idempotent-replayed"]).toBe("true");
      expect(again.body.id).toBe(first.body.id);
      expect(await prisma().attendanceVerification.count()).toBe(2);

      const other = await record(auth, "check-in", location).expect(409);
      expect(other.body.error.code).toBe("ATTENDANCE_ALREADY_CHECKED_IN");
    });

    it("keeps the photo for a retake when the attendance itself is refused", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "04:00:00");
      await uploadPhoto(auth, "check_in");
      const res = await record(auth, "check-in", location).expect(422);
      expect(res.body.error.code).toBe("CHECK_IN_TOO_EARLY");
      expect(await prisma().attendanceVerification.count()).toBe(0);
      expect(await prisma().verificationPendingPhoto.count()).toBe(1);
    });
  });

  describe("location at check-in (Phase 7A)", () => {
    beforeEach(async () => {
      await start();
      await enable({ locationEnabled: true, selfieEnabled: false }).expect(200);
    });

    const share = (auth: Auth, reading: object) => record(auth, "check-in", { location: reading });

    it("verifies a reading inside the area and stores no coordinates", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      const attendance = await share(auth, { ...HOME, accuracyMeters: 12.4 }).expect(201);

      const row = await prisma().attendanceVerification.findFirstOrThrow();
      expect(row).toMatchObject({
        attendanceId: attendance.body.id,
        moment: "check_in",
        result: "verified",
        accuracyMeters: 12,
        distanceBand: "within_1km",
      });
      expect(JSON.stringify(row)).not.toContain("106.81");
      const audit = JSON.stringify(await auditOf());
      expect(audit).not.toContain("verified");
    });

    it("flags a reading outside the area, and still records attendance as usual", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      const attendance = await share(auth, { ...ELSEWHERE, accuracyMeters: 20 }).expect(201);

      const list = await http()
        .get("/v1/attendance-verification?flagged=true")
        .set(adminAuth)
        .expect(200);
      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0]).toMatchObject({
        moment: "check_in",
        result: "outside_approved_area",
        flagged: true,
        diagnostics: { accuracyMeters: 20, distanceBand: "within_10km" },
      });
      const stored = await prisma().attendance.findUniqueOrThrow({
        where: { id: attendance.body.id },
      });
      expect(stored).toMatchObject({ status: "present", version: 1 });
    });

    it("records low accuracy without a flag", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      await share(auth, { ...ELSEWHERE, accuracyMeters: 2500 }).expect(201);
      expect((await mine(auth).expect(200)).body.results).toEqual([
        { moment: "check_in", method: "location", result: "low_accuracy" },
      ]);
      const flagged = await http()
        .get("/v1/attendance-verification?flagged=true")
        .set(adminAuth)
        .expect(200);
      expect(flagged.body.total).toBe(0);
    });

    it("records 'no approved area' without one, and no flag", async () => {
      const { auth } = await anEmployee();
      await acknowledge(auth);
      at(MONDAY, "09:00:00");
      await share(auth, { ...HOME, accuracyMeters: 10 }).expect(201);
      expect((await mine(auth).expect(200)).body.results).toEqual([
        { moment: "check_in", method: "location", result: "no_approved_area" },
      ]);
      const stored = await prisma().attendanceVerification.findFirstOrThrow();
      expect(stored.accuracyMeters).toBeNull();
    });

    it("needs no photo while only location is on", async () => {
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      await share(auth, { ...HOME, accuracyMeters: 10 }).expect(201);
      const upload = await http()
        .post("/v1/attendance-verification/photo-upload")
        .set(auth)
        .send({ moment: "check_in", contentType: "image/jpeg", size: JPEG.length })
        .expect(409);
      expect(upload.body.error.code).toBe("VERIFICATION_DISABLED");
    });

    it("shows managers their direct reports' status only, without diagnostics", async () => {
      const managerUser = await aUser(["attendance:self", "attendance:read_team"]);
      const report = await readyEmployee(managerUser.employee.id);
      const other = await readyEmployee();
      at(MONDAY, "09:00:00");
      await share(report.auth, { ...ELSEWHERE, accuracyMeters: 20 }).expect(201);
      await share(other.auth, { ...ELSEWHERE, accuracyMeters: 20 }).expect(201);

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
      await share(auth, { ...ELSEWHERE, accuracyMeters: 20 }).expect(201);
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
      await share(auth, { ...HOME, accuracyMeters: 10 }).expect(201);
      const row = await prisma().attendanceVerification.findFirstOrThrow();
      const outsider = await createUser(app, { permissions: ["verification:manage"] });
      await http()
        .post(`/v1/attendance-verification/${row.id}/review`)
        .set(await authHeader(app, outsider))
        .expect(404);
    });
  });

  describe("offices (decision V13)", () => {
    beforeEach(async () => {
      await start();
      await enable({ locationEnabled: true, selfieEnabled: false }).expect(200);
    });

    const share = (auth: Auth, reading: object) => record(auth, "check-in", { location: reading });
    const addOffice = (auth: Auth = adminAuth) =>
      http()
        .post("/v1/attendance-verification/offices")
        .set(auth)
        .send({ label: "Jakarta HQ", ...OFFICE, radiusMeters: 200 });

    it("says at office, unflagged, for someone with a home area", async () => {
      await addOffice().expect(201);
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      await share(auth, { ...OFFICE, accuracyMeters: 20 }).expect(201);

      expect((await mine(auth).expect(200)).body.results).toEqual([
        { moment: "check_in", method: "location", result: "at_office" },
      ]);
      const flagged = await http()
        .get("/v1/attendance-verification?flagged=true")
        .set(adminAuth)
        .expect(200);
      expect(flagged.body.total).toBe(0);
    });

    it("says at office for someone with no home area, and shows them only the names", async () => {
      await addOffice().expect(201);
      const { auth } = await anEmployee();
      await acknowledge(auth);
      const shown = (await mine(auth).expect(200)).body.offices;
      expect(shown).toEqual([{ label: "Jakarta HQ" }]);

      at(MONDAY, "09:00:00");
      await share(auth, { ...OFFICE, accuracyMeters: 20 }).expect(201);
      const row = await prisma().attendanceVerification.findFirstOrThrow();
      expect(row).toMatchObject({ result: "at_office", accuracyMeters: 20 });
    });

    it("still says at home inside the home area", async () => {
      await addOffice().expect(201);
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      await share(auth, { ...HOME, accuracyMeters: 20 }).expect(201);
      const row = await prisma().attendanceVerification.findFirstOrThrow();
      expect(row.result).toBe("verified");
    });

    it("flags a reading outside the home area and every office", async () => {
      await addOffice().expect(201);
      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      await share(auth, { ...ELSEWHERE, accuracyMeters: 20 }).expect(201);
      const flagged = await http()
        .get("/v1/attendance-verification?flagged=true")
        .set(adminAuth)
        .expect(200);
      expect(flagged.body.items[0]).toMatchObject({ result: "outside_approved_area" });
    });

    it("doesn't flag someone with no home area who isn't at an office", async () => {
      await addOffice().expect(201);
      const { auth } = await anEmployee();
      await acknowledge(auth);
      at(MONDAY, "09:00:00");
      await share(auth, { ...ELSEWHERE, accuracyMeters: 20 }).expect(201);
      const row = await prisma().attendanceVerification.findFirstOrThrow();
      expect(row).toMatchObject({ result: "no_approved_area", accuracyMeters: null });
    });

    it("stops counting an office once it's removed, and audits by name only", async () => {
      const office = await addOffice().expect(201);
      expect(office.body).toMatchObject({ label: "Jakarta HQ", radiusMeters: 200 });
      await http()
        .delete(`/v1/attendance-verification/offices/${office.body.id}`)
        .set(adminAuth)
        .expect(204);
      const list = await http().get("/v1/attendance-verification/offices").set(adminAuth);
      expect(list.body.items).toEqual([]);

      const { auth } = await readyEmployee();
      at(MONDAY, "09:00:00");
      await share(auth, { ...OFFICE, accuracyMeters: 20 }).expect(201);
      const row = await prisma().attendanceVerification.findFirstOrThrow();
      expect(row.result).toBe("outside_approved_area");

      const audit = await auditOf();
      expect(audit.map((entry) => entry.action)).toEqual(
        expect.arrayContaining([
          "attendance_verification.office_added",
          "attendance_verification.office_removed",
        ]),
      );
      expect(JSON.stringify(audit)).not.toContain(String(OFFICE.longitude));
    });

    it("is for verification:manage only", async () => {
      const { auth } = await anEmployee();
      await addOffice(auth).expect(403);
      await http().get("/v1/attendance-verification/offices").set(auth).expect(403);
      await http()
        .delete(`/v1/attendance-verification/offices/${randomUUID()}`)
        .set(auth)
        .expect(403);
    });

    it("rejects a radius out of range and unknown fields", async () => {
      const send = (body: object) =>
        http()
          .post("/v1/attendance-verification/offices")
          .set(adminAuth)
          .send({ label: "HQ", ...OFFICE, radiusMeters: 200, ...body });
      await send({ radiusMeters: 99 }).expect(400);
      await send({ radiusMeters: 10_001 }).expect(400);
      await send({ organizationId: randomUUID() }).expect(400);
    });

    it("keeps offices within their organization", async () => {
      const office = await addOffice().expect(201);
      const stranger = await createUser(app, {
        permissions: ["verification:manage", "attendance:read_all"],
      });
      const strangerAuth = await authHeader(app, stranger);
      await http()
        .delete(`/v1/attendance-verification/offices/${office.body.id}`)
        .set(strangerAuth)
        .expect(404);
      const list = await http().get("/v1/attendance-verification/offices").set(strangerAuth);
      expect(list.body.items).toEqual([]);
    });
  });

  describe("selfie at check-in (Phase 7B)", () => {
    beforeEach(async () => {
      await start();
      await enable({ locationEnabled: false, selfieEnabled: true }).expect(200);
    });

    const takeSelfie = async (auth: Auth) => {
      await uploadPhoto(auth, "check_in");
      return record(auth, "check-in").expect(201);
    };

    it("stores the photo apart from the uploads module, for Admin/HR with photo access only", async () => {
      const managerUser = await aUser(["attendance:self", "attendance:read_team"]);
      const { auth } = await anEmployee(managerUser.employee.id);
      await acknowledge(auth);
      at(MONDAY, "09:00:00");
      await takeSelfie(auth);
      expect((await mine(auth).expect(200)).body.results).toEqual([
        { moment: "check_in", method: "selfie", result: "captured" },
      ]);
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

    it("removes a photo that's never used", async () => {
      const { auth } = await anEmployee();
      await acknowledge(auth);
      at(MONDAY, "09:00:00");
      await uploadPhoto(auth, "check_in");
      const { key } = await prisma().verificationPendingPhoto.findFirstOrThrow();

      await app.get(AttendanceVerificationService).purgeExpired(new Date(wib(MONDAY, "23:00:00")));
      expect(await prisma().verificationPendingPhoto.count()).toBe(1);

      await app
        .get(AttendanceVerificationService)
        .purgeExpired(new Date(wib("2026-11-04", "09:00:00")));
      expect(await prisma().verificationPendingPhoto.count()).toBe(0);
      expect(await app.get(StorageService).head(key)).toBeNull();
    });

    it("discloses an employee's own photo only after an identity check, audited", async () => {
      const { auth } = await anEmployee();
      await acknowledge(auth);
      at(MONDAY, "09:00:00");
      await takeSelfie(auth);

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
      const attendance = await takeSelfie(auth);
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
