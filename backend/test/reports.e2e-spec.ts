import { randomUUID } from "node:crypto";

import type { NestExpressApplication } from "@nestjs/platform-express";

import request from "supertest";

import type { Permission } from "@/common/types/auth.js";

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

const wib = (date: string, time: string) => `${date}T${time}+07:00`;
const THU = "2026-10-29";
const FRI = "2026-10-30";
const MON = "2026-11-02"; // today (10:00 WIB by default)

type Auth = { Authorization: string };
type Person = { user: TestUser; employee: { id: string }; auth: Auth };
type Item = {
  status: string;
  completion: string;
  incomplete: boolean;
  corrected: boolean;
  lateMinutes: number;
  workedMinutes: number | null;
  workDate: string;
  employee: { id: string; employeeNumber: string; fullName: string };
};

describe("Team, dashboards and reports (e2e)", () => {
  let app: NestExpressApplication;
  let owner: TestUser;
  let hr: Auth; // attendance:read_all, report:read_all
  let manager: Person; // attendance:read_team, report:read_team
  let a: Person; // reports to manager, division 1
  let b: Person; // reports to manager, division 2
  let c: Person; // not a report, division 1
  let division1: string;
  let division2: string;

  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const at = (date: string, time: string) => clockOf(app).set(wib(date, time));
  const get = (auth: Auth, path: string) => http().get(path).set(auth);

  const person = async (
    permissions: Permission[],
    options: { divisionId: string; managerId?: string },
  ): Promise<Person> => {
    const user = await createUser(app, {
      sameOrganizationAs: owner,
      permissions: ["attendance:self", "correction:submit", ...permissions],
    });
    const employee = await createEmployee(app, owner, { ...options, userId: user.id });
    return { user, employee, auth: await authHeader(app, user) };
  };
  const checkIn = (who: Person, date: string, time: string) => {
    at(date, time);
    return http()
      .post("/v1/attendance/check-in")
      .set(who.auth)
      .set("Idempotency-Key", randomUUID())
      .expect(201);
  };
  const checkOut = (who: Person, date: string, time: string) => {
    at(date, time);
    return http()
      .post("/v1/attendance/check-out")
      .set(who.auth)
      .set("Idempotency-Key", randomUUID())
      .expect(200);
  };
  const closeDay = (date: string) =>
    http().post("/v1/attendance/close-day").set(hr).send({ date }).expect(200);

  /**
   * Thu: A complete, B late and never checks out, C absent.
   * Fri: A late + complete, B complete (corrected to present), C on time, never checks out.
   * Mon (today, 10:00): A checked in, B not yet, C late.
   * The manager never checks in: absent on Thu and Fri, not checked in today.
   */
  const week = async () => {
    await checkIn(a, THU, "08:55:00");
    await checkOut(a, THU, "17:05:00");
    await checkIn(b, THU, "09:30:00");
    await checkIn(a, FRI, "09:20:00");
    await checkOut(a, FRI, "17:00:00");
    const bFri = await checkIn(b, FRI, "09:00:00");
    await checkOut(b, FRI, "17:00:00");
    await checkIn(c, FRI, "09:10:00");
    at(MON, "08:00:00");
    await closeDay(THU);
    await closeDay(FRI);
    // B's Friday check-in corrected to 08:30 (approved by HR)
    const submitted = await http()
      .post("/v1/correction-requests")
      .set(b.auth)
      .send({
        attendanceId: bFri.body.id,
        requestedCheckInAt: wib(FRI, "08:30:00"),
        reason: "Started early on the release checklist.",
      })
      .expect(201);
    await http()
      .post(`/v1/correction-requests/${submitted.body.id}/approve`)
      .set(hr)
      .send({})
      .expect(200);
    // A pending one, for the dashboard
    const bThu = await prisma().attendance.findFirstOrThrow({
      where: { employeeId: b.employee.id, workDate: new Date(`${THU}T00:00:00Z`) },
    });
    await http()
      .post("/v1/correction-requests")
      .set(b.auth)
      .send({
        attendanceId: bThu.id,
        requestedCheckOutAt: wib(THU, "17:00:00"),
        reason: "Forgot to check out after the demo.",
      })
      .expect(201);
    await checkIn(a, MON, "09:00:00");
    await checkIn(c, MON, "09:40:00");
    at(MON, "10:00:00");
  };

  /** The summary the API should give for these items (DOMAIN_RULES.md §13). */
  const summaryOf = (items: Item[]) => {
    const count = (fn: (i: Item) => boolean) => items.filter(fn).length;
    return {
      records: items.length,
      present: count((i) => i.status === "present"),
      late: count((i) => i.status === "late"),
      attended: count((i) => i.status === "present" || i.status === "late"),
      absent: count((i) => i.status === "absent"),
      excused: count((i) => i.status === "excused"),
      complete: count((i) => i.completion === "complete"),
      open: count((i) => i.completion === "open" && !i.incomplete),
      incomplete: count((i) => i.incomplete),
      workedMinutes: items.reduce(
        (sum, i) => sum + (i.completion === "complete" ? (i.workedMinutes ?? 0) : 0),
        0,
      ),
      lateMinutes: items.reduce((sum, i) => sum + i.lateMinutes, 0),
      corrected: count((i) => i.corrected),
    };
  };

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    owner = await createUser(app);
    division1 = (await createDivision(app, owner)).id;
    division2 = (await createDivision(app, owner)).id;
    await createSchedule(app, owner);
    const hrUser = await createUser(app, {
      sameOrganizationAs: owner,
      permissions: [
        "attendance:read_all",
        "report:read_all",
        "policy:manage",
        "correction:decide_all",
      ],
    });
    hr = await authHeader(app, hrUser);
    manager = await person(["attendance:read_team", "report:read_team"], {
      divisionId: division1,
    });
    a = await person([], { divisionId: division1, managerId: manager.employee.id });
    b = await person([], { divisionId: division2, managerId: manager.employee.id });
    c = await person([], { divisionId: division1 });
  });

  afterEach(async () => {
    await app.close();
  });

  describe("reports (GET /v1/reports/attendance)", () => {
    it("summaries reconcile with the records for every filter", async () => {
      await week();
      for (const filter of [
        "",
        `&divisionId=${division1}`,
        `&employeeId=${b.employee.id}`,
        "&status=late",
        "&status=absent",
        "&completion=incomplete",
        "&completion=open",
        "&completion=complete",
      ]) {
        const res = await get(
          hr,
          `/v1/reports/attendance?from=${THU}&to=${MON}&pageSize=100${filter}`,
        ).expect(200);
        expect(res.body.total).toBe(res.body.items.length);
        expect(res.body.summary).toEqual({ from: THU, to: MON, ...summaryOf(res.body.items) });
      }

      const all = await get(hr, `/v1/reports/attendance?from=${THU}&to=${MON}&pageSize=100`).expect(
        200,
      );
      expect(all.body.summary).toMatchObject({
        records: 10,
        present: 4, // A Thu, B Fri (corrected), C Fri, A Mon
        late: 3, // B Thu, A Fri, C Mon
        absent: 3, // C and the manager Thu, the manager Fri
        complete: 3,
        open: 2, // A and C today
        incomplete: 2, // B Thu, C Fri
        corrected: 1,
        workedMinutes: 490 + 460 + 510,
      });
      // Newest first, then employee number
      expect(all.body.items.map((i: Item) => i.workDate)).toEqual([
        MON,
        MON,
        FRI,
        FRI,
        FRI,
        FRI,
        THU,
        THU,
        THU,
        THU,
      ]);
      const corrected = all.body.items.find((i: Item) => i.corrected);
      expect(corrected).toMatchObject({
        employee: { id: b.employee.id },
        status: "present",
        workDate: FRI,
      });
    });

    it("pages without changing the summary", async () => {
      await week();
      const page1 = await get(hr, `/v1/reports/attendance?from=${THU}&to=${MON}&pageSize=3`).expect(
        200,
      );
      const page3 = await get(
        hr,
        `/v1/reports/attendance?from=${THU}&to=${MON}&pageSize=3&page=4`,
      ).expect(200);
      expect(page1.body.items).toHaveLength(3);
      expect(page3.body.items).toHaveLength(1);
      expect(page3.body.summary).toEqual(page1.body.summary);
    });

    it("scopes a manager to active direct reports", async () => {
      await week();
      const res = await get(
        manager.auth,
        `/v1/reports/attendance?from=${THU}&to=${MON}&pageSize=100`,
      ).expect(200);
      const people = new Set(res.body.items.map((i: Item) => i.employee.id));
      expect(people).toEqual(new Set([a.employee.id, b.employee.id]));
      expect(res.body.summary).toEqual({ from: THU, to: MON, ...summaryOf(res.body.items) });

      const outside = await get(
        manager.auth,
        `/v1/reports/attendance?from=${THU}&to=${MON}&employeeId=${c.employee.id}`,
      ).expect(200);
      expect(outside.body).toMatchObject({ total: 0, summary: { records: 0 } });

      await prisma().employee.update({
        where: { id: b.employee.id },
        data: { status: "inactive" },
      });
      const after = await get(
        manager.auth,
        `/v1/reports/attendance?from=${THU}&to=${MON}&pageSize=100`,
      ).expect(200);
      expect(new Set(after.body.items.map((i: Item) => i.employee.id))).toEqual(
        new Set([a.employee.id]),
      );

      await get(a.auth, `/v1/reports/attendance?from=${THU}&to=${MON}`).expect(403);
    });

    it("hides other organizations and validates the range", async () => {
      await week();
      const outsider = await createUser(app, {
        permissions: ["report:read_all", "attendance:read_all"],
      });
      const auth = await authHeader(app, outsider);
      const res = await get(auth, `/v1/reports/attendance?from=${THU}&to=${MON}`).expect(200);
      expect(res.body.total).toBe(0);
      await get(
        auth,
        `/v1/reports/attendance?from=${THU}&to=${MON}&employeeId=${a.employee.id}`,
      ).expect(200, /"total":0/);
      expect((await get(auth, "/v1/dashboard/organization").expect(200)).body.activeEmployees).toBe(
        0,
      );

      await get(hr, "/v1/reports/attendance").expect(400);
      await get(hr, `/v1/reports/attendance?from=${MON}&to=${THU}`).expect(400);
      await get(hr, "/v1/reports/attendance?from=2026-01-01&to=2027-01-02").expect(400);
      await get(hr, "/v1/reports/attendance?from=2026-01-01&to=2027-01-01").expect(200);
    });
  });

  describe("trends (GET /v1/reports/attendance/trends)", () => {
    it("lists every date with daily counts that add up to the report", async () => {
      await week();
      await prisma().holiday.create({
        data: {
          organizationId: owner.organizationId,
          date: new Date("2026-10-28T00:00:00Z"),
          name: "Test holiday",
          createdById: owner.id,
        },
      });
      const res = await get(hr, `/v1/reports/attendance/trends?from=2026-10-28&to=${MON}`).expect(
        200,
      );
      expect(
        res.body.items.map((d: { date: string; isWorkingDay: boolean }) => [
          d.date,
          d.isWorkingDay,
        ]),
      ).toEqual([
        ["2026-10-28", false],
        [THU, true],
        [FRI, true],
        ["2026-10-31", false],
        ["2026-11-01", false],
        [MON, true],
      ]);
      expect(res.body.items[1]).toEqual({
        date: THU,
        isWorkingDay: true,
        present: 1,
        late: 1,
        absent: 2,
        incomplete: 1,
      });

      const report = await get(hr, `/v1/reports/attendance?from=2026-10-28&to=${MON}`).expect(200);
      const total = (key: "present" | "late" | "absent" | "incomplete") =>
        res.body.items.reduce((sum: number, d: Record<string, number>) => sum + (d[key] ?? 0), 0);
      expect({
        present: total("present"),
        late: total("late"),
        absent: total("absent"),
        incomplete: total("incomplete"),
      }).toEqual({
        present: report.body.summary.present,
        late: report.body.summary.late,
        absent: report.body.summary.absent,
        incomplete: report.body.summary.incomplete,
      });

      const team = await get(
        manager.auth,
        `/v1/reports/attendance/trends?from=${THU}&to=${THU}`,
      ).expect(200);
      // C's and the manager's absences are outside the team
      expect(team.body.items[0]).toMatchObject({ present: 1, late: 1, absent: 0 });
    });
  });

  describe("team (GET /v1/team/attendance/today, /v1/team/attendance)", () => {
    it("shows each active direct report's state today, with matching cards", async () => {
      await week();
      const res = await get(manager.auth, "/v1/team/attendance/today").expect(200);
      expect(res.body).toMatchObject({
        workDate: MON,
        timezone: "Asia/Jakarta",
        isWorkingDay: true,
      });
      const states = Object.fromEntries(
        res.body.items.map((i: { employee: { id: string }; state: string }) => [
          i.employee.id,
          i.state,
        ]),
      );
      expect(states).toEqual({ [a.employee.id]: "checked_in", [b.employee.id]: "not_checked_in" });
      expect(res.body.summary).toEqual({
        employees: 2,
        present: 1,
        late: 0,
        notCheckedIn: 1,
        notCheckedOut: 0,
        absent: 0,
      });

      // A past day: B's Thursday is open past its end, C isn't in the team
      const thu = await get(manager.auth, `/v1/team/attendance/today?date=${THU}`).expect(200);
      expect(thu.body.summary).toEqual({
        employees: 2,
        present: 1,
        late: 1,
        notCheckedIn: 0,
        notCheckedOut: 1,
        absent: 0,
      });
      expect(
        thu.body.items.find((i: { employee: { id: string } }) => i.employee.id === b.employee.id),
      ).toMatchObject({
        state: "not_checked_out",
        record: { incomplete: true, pendingCorrectionId: expect.any(String) },
      });

      // A weekend
      const sat = await get(manager.auth, "/v1/team/attendance/today?date=2026-10-31").expect(200);
      expect(sat.body).toMatchObject({ isWorkingDay: false, nonWorkingReason: "non_working_day" });
      expect(sat.body.items.every((i: { state: string }) => i.state === "non_working_day")).toBe(
        true,
      );
    });

    it("limits team views to the last 90 days and to managers with a profile", async () => {
      await get(manager.auth, "/v1/team/attendance/today?date=2026-08-05").expect(200); // day 90
      const old = await get(manager.auth, "/v1/team/attendance/today?date=2026-08-04").expect(400);
      expect(old.body.error.details.fieldErrors.date).toEqual([
        "Team history starts on 2026-08-05",
      ]);
      await get(manager.auth, "/v1/team/attendance/today?date=2026-11-03").expect(400);
      await get(manager.auth, "/v1/team/attendance?from=2026-08-04").expect(400);

      await get(hr, "/v1/team/attendance/today").expect(403);
      const noProfile = await createUser(app, {
        sameOrganizationAs: owner,
        permissions: ["attendance:read_team"],
      });
      await get(await authHeader(app, noProfile), "/v1/team/attendance/today").expect(
        422,
        /EMPLOYEE_PROFILE_REQUIRED/,
      );
    });

    it("lists direct reports' records, newest first", async () => {
      await week();
      const res = await get(manager.auth, "/v1/team/attendance?pageSize=100").expect(200);
      expect(res.body.total).toBe(5); // A ×3, B ×2
      expect(new Set(res.body.items.map((i: Item) => i.employee.id))).toEqual(
        new Set([a.employee.id, b.employee.id]),
      );
      expect(res.body.items[0].workDate).toBe(MON);

      const filtered = await get(
        manager.auth,
        `/v1/team/attendance?employeeId=${c.employee.id}`,
      ).expect(200);
      expect(filtered.body.total).toBe(0);
      const incomplete = await get(
        manager.auth,
        "/v1/team/attendance?completion=incomplete",
      ).expect(200);
      expect(incomplete.body.items.map((i: Item) => [i.employee.id, i.workDate])).toEqual([
        [b.employee.id, THU],
      ]);
    });
  });

  describe("organization dashboard (GET /v1/dashboard/organization)", () => {
    it("counts today, pending corrections and the 30-working-day trend", async () => {
      await week();
      const res = await get(hr, "/v1/dashboard/organization").expect(200);
      expect(res.body).toMatchObject({
        workDate: MON,
        isWorkingDay: true,
        checkInWindowClosed: false,
        activeEmployees: 4, // manager, A, B, C
        present: 1,
        late: 1,
        absent: 0,
        notCheckedIn: 2, // manager, B
        notCheckedOut: 0,
        pendingCorrections: 1,
      });
      expect(res.body.trend).toHaveLength(30);
      expect(res.body.trend.at(-1)).toMatchObject({ date: MON, present: 1, late: 1 });
      expect(res.body.trend.at(-2)).toMatchObject({
        date: FRI,
        present: 2,
        late: 1,
        absent: 1,
        incomplete: 1,
      });

      const d2 = await get(hr, `/v1/dashboard/organization?divisionId=${division2}`).expect(200);
      expect(d2.body).toMatchObject({
        activeEmployees: 1,
        present: 0,
        notCheckedIn: 1,
        pendingCorrections: 1,
      });

      // After the window closes, "not checked in" is final until close-day
      at(MON, "17:00:01");
      const evening = await get(hr, "/v1/dashboard/organization").expect(200);
      expect(evening.body).toMatchObject({
        checkInWindowClosed: true,
        notCheckedIn: 2,
        notCheckedOut: 2,
      });

      await get(manager.auth, "/v1/dashboard/organization").expect(403);
    });
  });

  describe("CSV export (GET /v1/reports/attendance.csv)", () => {
    it("exports the full filtered report, neutralized and audited", async () => {
      await week();
      await prisma().employee.update({
        where: { id: c.employee.id },
        data: { fullName: '=HYPERLINK("http://evil")' },
      });

      const res = await get(hr, `/v1/reports/attendance.csv?from=${THU}&to=${MON}`)
        .buffer(true)
        .parse((response, done) => {
          let text = "";
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => (text += chunk));
          response.on("end", () => done(null, text));
        })
        .expect(200);
      expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
      expect(res.headers["content-disposition"]).toBe(
        `attachment; filename="attendance-${THU}-to-${MON}.csv"`,
      );
      const text = res.body as string;
      expect(text.startsWith("﻿workDate,employeeNumber,employeeName,divisionName,timezone,")).toBe(
        true,
      );
      const lines = text.trimEnd().split("\r\n");
      expect(lines).toHaveLength(1 + 10);
      expect(text).toContain(`"'=HYPERLINK(""http://evil"")"`);
      expect(text).not.toMatch(/,=HYPERLINK/);
      const bFri = lines.find(
        (line) => line.startsWith(FRI) && line.includes("present") && line.includes(",true,"),
      );
      expect(bFri).toContain(
        ",2026-10-30T08:30:00+07:00,2026-10-30T17:00:00+07:00,present,0,510,complete,true,Corrected",
      );
      const bThu = lines.find((line) => line.startsWith(THU) && line.includes(",late,"));
      expect(bThu).toContain(",incomplete,false,Missing check-out; Correction pending");

      const [entry] = await prisma().auditLog.findMany({
        where: { action: "report_export.created" },
      });
      expect(entry).toMatchObject({ targetType: "report_export", targetId: null });
      expect(entry?.metadata).toMatchObject({
        report: "attendance",
        format: "csv",
        rows: 10,
        filters: { from: THU, to: MON },
      });

      await get(manager.auth, `/v1/reports/attendance.csv?from=${THU}&to=${MON}`).expect(403);
      await get(hr, "/v1/reports/attendance.csv?from=2026-11-02").expect(400);
    });
  });
});
