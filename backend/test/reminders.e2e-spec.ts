import { getQueueToken } from "@nestjs/bullmq";
import type { NestExpressApplication } from "@nestjs/platform-express";

import type { Queue } from "bullmq";
import request from "supertest";

import { MailService, type MailMessage } from "@/infra/mail/mail.service.js";
import { MemoryMailer } from "@/infra/mail/mailers.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import { NOTIFICATION_EMAILS_QUEUE } from "@/modules/notifications/jobs/notification-emails.queue.js";
import { NotificationsService } from "@/modules/notifications/notifications.service.js";

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

const MONDAY = "2026-11-02";
const wib = (time: string, date = MONDAY) => `${date}T${time}+07:00`;

type Person = { user: TestUser; employee: { id: string }; auth: { Authorization: string } };

describe("Reminders (e2e, DOMAIN_RULES.md §18.4)", () => {
  let app: NestExpressApplication;
  let hr: TestUser; // policy:manage, no profile
  let divisionId: string;
  let waiting: Person; // never checks in
  let working: Person; // checked in at 08:47, no check-out
  let done: Person; // checked in and out

  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const at = (time: string, date = MONDAY) => clockOf(app).set(wib(time, date));
  const emailQueue = () => app.get<Queue>(getQueueToken(NOTIFICATION_EMAILS_QUEUE));
  const mailbox = (): MailMessage[] => {
    const mailer = app.get(MailService);
    if (!(mailer instanceof MemoryMailer)) throw new Error("tests expect MAIL_TRANSPORT=memory");
    return mailer.sent;
  };
  const subjectsTo = (who: Person) =>
    mailbox()
      .filter((message) => message.to === who.user.email)
      .map((message) => message.subject);

  /** One scheduled check at the given Jakarta time, then every email it queued. */
  const runAt = async (time: string, date = MONDAY) => {
    at(time, date);
    const created = await app.get(NotificationsService).createDueReminders(clockOf(app).now());
    await waitForJobs(app);
    return created;
  };

  const person = async (options: { inactive?: boolean; disabled?: boolean } = {}) => {
    const user = await createUser(app, {
      permissions: ["attendance:self"],
      sameOrganizationAs: hr,
      ...(options.disabled && { disabled: true }),
    });
    const employee = await createEmployee(app, user, {
      divisionId,
      userId: user.id,
      ...(options.inactive && { inactive: true }),
    });
    return { user, employee, auth: await authHeader(app, user) };
  };

  const checkIn = async (who: Person, time: string) => {
    at(time);
    await http()
      .post("/v1/attendance/check-in")
      .set(who.auth)
      .set("Idempotency-Key", crypto.randomUUID())
      .expect(201);
  };
  const checkOut = async (who: Person, time: string) => {
    at(time);
    await http()
      .post("/v1/attendance/check-out")
      .set(who.auth)
      .set("Idempotency-Key", crypto.randomUUID())
      .expect(200);
  };

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    hr = await createUser(app, { permissions: ["policy:manage"] });
    divisionId = (await createDivision(app, hr)).id;
    await createSchedule(app, hr);
    waiting = await person();
    working = await person();
    done = await person();
    await checkIn(working, "08:47:00");
    await checkIn(done, "08:30:00");
    await checkOut(done, "08:50:00");
  });

  afterEach(async () => {
    await app.close();
  });

  describe("check-in reminder", () => {
    it("emails only employees without a record, once, from 09:00", async () => {
      expect(await runAt("08:59:59")).toBe(0);
      expect(await runAt("09:00:00")).toBe(1);
      expect(await runAt("09:05:00")).toBe(0);

      expect(subjectsTo(waiting)).toEqual(["Reminder: you haven't checked in today"]);
      expect(subjectsTo(working)).toEqual([]);
      expect(subjectsTo(done)).toEqual([]);
      const [email] = mailbox();
      expect(email?.text).toContain("Check-in closes at 17:00 WIB.");
      expect(email?.text).toContain("http://localhost:3000/attendance");

      const rows = await prisma().notification.findMany();
      expect(rows).toEqual([
        expect.objectContaining({
          recipientId: waiting.user.id,
          type: "reminder_check_in",
          subjectId: waiting.employee.id,
          dedupeKey: `reminder_check_in:${waiting.employee.id}:${MONDAY}`,
          status: "sent",
          expiresAt: new Date(wib("17:00:00")),
        }),
      ]);
    });

    it("leaves out inactive employees, deactivated accounts and profiles without one", async () => {
      await person({ inactive: true });
      await person({ disabled: true });
      await createEmployee(app, hr, { divisionId }); // no account
      expect(await runAt("09:00:00")).toBe(1);
      expect(mailbox()).toHaveLength(1);
    });

    it("isn't sent more than 2 hours late", async () => {
      expect(await runAt("11:00:00")).toBe(0);
    });

    it("isn't sent on weekends or holidays", async () => {
      expect(await runAt("09:00:00", "2026-11-07")).toBe(0); // Saturday
      await prisma().holiday.create({
        data: {
          organizationId: hr.organizationId,
          date: new Date("2026-11-04T00:00:00Z"),
          name: "Company Day",
          createdById: hr.id,
        },
      });
      expect(await runAt("09:00:00", "2026-11-04")).toBe(0);
    });

    it("is skipped if the employee checks in before it goes out", async () => {
      await emailQueue().pause();
      expect(
        await app.get(NotificationsService).createDueReminders(new Date(wib("09:00:00"))),
      ).toBe(1);
      await checkIn(waiting, "09:01:00");
      await emailQueue().resume();
      await waitForJobs(app);

      expect(mailbox()).toHaveLength(0);
      expect((await prisma().notification.findFirstOrThrow()).status).toBe("skipped");
    });

    it("is skipped if check-in has closed before it goes out", async () => {
      await http()
        .patch("/v1/work-settings")
        .set(await authHeader(app, hr))
        .send({ checkInReminderTime: "16:30" })
        .expect(200);
      await emailQueue().pause();
      at("16:59:00");
      expect(await app.get(NotificationsService).createDueReminders(clockOf(app).now())).toBe(1);
      at("17:00:00");
      await emailQueue().resume();
      await waitForJobs(app);

      expect(mailbox()).toHaveLength(0);
      expect((await prisma().notification.findFirstOrThrow()).status).toBe("skipped");
    });
  });

  describe("check-out reminder", () => {
    it("emails only employees with an open record, from 18:00", async () => {
      expect(await runAt("17:59:59")).toBe(0);
      expect(await runAt("18:00:00")).toBe(1);

      expect(subjectsTo(working)).toEqual(["Reminder: check out when you finish work"]);
      expect(subjectsTo(waiting)).toEqual([]);
      expect(subjectsTo(done)).toEqual([]);
      expect(mailbox()[0]?.text).toContain(
        "You checked in at 08:47 WIB on Monday, 2 November 2026",
      );
    });

    it("is skipped if the employee checks out before it goes out", async () => {
      await emailQueue().pause();
      expect(
        await app.get(NotificationsService).createDueReminders(new Date(wib("18:00:00"))),
      ).toBe(1);
      await checkOut(working, "18:01:00");
      await emailQueue().resume();
      await waitForJobs(app);

      expect(mailbox()).toHaveLength(0);
    });
  });

  describe("settings", () => {
    it("Admin/HR change the times and turn reminders off; changes are audited", async () => {
      const auth = await authHeader(app, hr);
      const res = await http()
        .patch("/v1/work-settings")
        .set(auth)
        .send({ checkInReminderTime: "10:30", checkOutReminderEnabled: false })
        .expect(200);
      expect(res.body).toMatchObject({
        checkInReminderEnabled: true,
        checkInReminderTime: "10:30",
        checkOutReminderEnabled: false,
        checkOutReminderTime: "18:00",
      });

      expect(await runAt("09:00:00")).toBe(0);
      expect(await runAt("10:30:00")).toBe(1);
      expect(await runAt("18:00:00")).toBe(0);

      const audit = await prisma().auditLog.findMany({ where: { targetId: hr.organizationId } });
      expect(audit.map((entry) => entry.metadata)).toEqual([
        { fields: ["checkInReminderTime", "checkOutReminderEnabled"] },
      ]);
    });

    it("rejects malformed times and other roles", async () => {
      const auth = await authHeader(app, hr);
      for (const time of ["9:00", "24:00", "09:00:00", "09:60"]) {
        await http()
          .patch("/v1/work-settings")
          .set(auth)
          .send({ checkInReminderTime: time })
          .expect(400);
      }
      await http()
        .patch("/v1/work-settings")
        .set(waiting.auth)
        .send({ checkInReminderEnabled: false })
        .expect(403);
    });
  });

  it("deletes notifications older than 90 days (§18.5)", async () => {
    await runAt("09:00:00");
    const [row] = await prisma().notification.findMany();
    if (!row) throw new Error("expected a notification");
    await prisma().notification.update({
      where: { id: row.id },
      data: { createdAt: new Date(Date.parse(wib("09:00:00")) - 91 * 24 * 60 * 60 * 1000) },
    });
    expect(await app.get(NotificationsService).purgeExpired(clockOf(app).now())).toBe(1);
    expect(await prisma().notification.count()).toBe(0);
  });
});
