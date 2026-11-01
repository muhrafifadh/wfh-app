import { getQueueToken } from "@nestjs/bullmq";
import type { NestExpressApplication } from "@nestjs/platform-express";

import type { Queue } from "bullmq";
import request from "supertest";

import type { Permission } from "@/common/types/auth.js";
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

const wib = (date: string, time: string) => `${date}T${time}+07:00`;
const MONDAY = "2026-11-02";
const TUESDAY = "2026-11-03";
const REASON = "Forgot to tap check-in, was online from 09:00.";

type Person = {
  user: TestUser;
  employee: { id: string };
  auth: { Authorization: string };
  fullName: string;
};

describe("Notifications (e2e, DOMAIN_RULES.md §18)", () => {
  let app: NestExpressApplication;
  let owner: TestUser;
  let divisionId: string;
  let hr: Person; // correction:decide_all
  let manager: Person; // correction:decide_team
  let report: Person; // reports to manager

  const http = () => request(app.getHttpServer());
  const prisma = () => app.get(PrismaService);
  const at = (date: string, time: string) => clockOf(app).set(wib(date, time));
  const mailbox = (): MailMessage[] => {
    const mailer = app.get(MailService);
    if (!(mailer instanceof MemoryMailer)) throw new Error("tests expect MAIL_TRANSPORT=memory");
    return mailer.sent;
  };
  const mailTo = (who: Person) => mailbox().filter((message) => message.to === who.user.email);

  const person = async (
    permissions: Permission[],
    options: { managerId?: string; disabled?: boolean } = {},
  ): Promise<Person> => {
    const user = await createUser(app, {
      permissions: ["attendance:self", "correction:submit", ...permissions],
      sameOrganizationAs: owner,
      ...(options.disabled && { disabled: true }),
    });
    const employee = await createEmployee(app, user, {
      divisionId,
      userId: user.id,
      managerId: options.managerId,
    });
    const { fullName } = await prisma().employee.findUniqueOrThrow({
      where: { id: employee.id },
      select: { fullName: true },
    });
    return { user, employee, auth: await authHeader(app, user), fullName };
  };

  /** Monday: late check-in, no check-out; Tuesday: a correction for it. Returns its id. */
  const requestCorrection = async (who: Person): Promise<string> => {
    at(MONDAY, "09:30:00");
    const checkIn = await http()
      .post("/v1/attendance/check-in")
      .set(who.auth)
      .set("Idempotency-Key", crypto.randomUUID())
      .expect(201);
    at(TUESDAY, "10:00:00");
    const res = await http()
      .post("/v1/correction-requests")
      .set(who.auth)
      .send({
        attendanceId: checkIn.body.id,
        requestedCheckInAt: wib(MONDAY, "09:00:00"),
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
        reason: REASON,
      })
      .expect(201);
    return res.body.id as string;
  };

  const notificationsFor = (correctionId: string) =>
    prisma().notification.findMany({
      where: { subjectId: correctionId },
      orderBy: { createdAt: "asc" },
    });

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    owner = await createUser(app);
    divisionId = (await createDivision(app, owner)).id;
    await createSchedule(app, owner);
    hr = await person(["correction:decide_all"]);
    manager = await person(["correction:decide_team"]);
    report = await person([], { managerId: manager.employee.id });
  });

  afterEach(async () => {
    await app.close();
  });

  describe("correction submitted (§18.2)", () => {
    it("emails the direct manager once, with who asked, the day and a link", async () => {
      const id = await requestCorrection(report);
      await waitForJobs(app);

      expect(mailbox()).toHaveLength(1);
      const [email] = mailTo(manager);
      expect(email?.subject).toBe(
        `Correction request from ${report.fullName} for Monday, 2 November 2026`,
      );
      expect(email?.text).toContain(`http://localhost:3000/corrections/${id}`);
      expect(email?.text).not.toContain(REASON);

      const [notification] = await notificationsFor(id);
      expect(notification).toMatchObject({
        recipientId: manager.user.id,
        type: "correction_submitted",
        status: "sent",
        dedupeKey: `correction_submitted:${id}:${manager.user.id}`,
      });
      expect(notification?.sentAt).not.toBeNull();
    });

    it("emails everyone who decides any correction when there is no manager", async () => {
      const hr2 = await person(["correction:decide_all"]);
      const loner = await person([]);
      await requestCorrection(loner);
      await waitForJobs(app);

      expect(mailTo(hr)).toHaveLength(1);
      expect(mailTo(hr2)).toHaveLength(1);
      expect(mailTo(manager)).toHaveLength(0);
      expect(mailTo(loner)).toHaveLength(0);
    });

    it("falls back to Admin/HR when the manager can't decide or their account is off", async () => {
      const viewer = await person(["attendance:read_team"]);
      const disabled = await person(["correction:decide_team"], { disabled: true });
      const underViewer = await person([], { managerId: viewer.employee.id });
      const underDisabled = await person([], { managerId: disabled.employee.id });

      await requestCorrection(underViewer);
      await requestCorrection(underDisabled);
      await waitForJobs(app);

      expect(mailTo(viewer)).toHaveLength(0);
      expect(mailTo(disabled)).toHaveLength(0);
      expect(mailTo(hr)).toHaveLength(2);
    });

    it("never emails the requester about their own request (Scenario I)", async () => {
      const hr2 = await person(["correction:decide_all"]);
      await requestCorrection(hr);
      await waitForJobs(app);

      expect(mailTo(hr)).toHaveLength(0);
      expect(mailTo(hr2)).toHaveLength(1);
    });

    it("never creates a second notification when the event repeats", async () => {
      const id = await requestCorrection(report);
      await app.get(NotificationsService).correctionSubmitted(owner.organizationId, id);
      await waitForJobs(app);

      expect(await notificationsFor(id)).toHaveLength(1);
      expect(mailTo(manager)).toHaveLength(1);
    });

    it("skips the review email when the request was decided before its turn", async () => {
      const queue = app.get<Queue>(getQueueToken(NOTIFICATION_EMAILS_QUEUE));
      await queue.pause();
      const id = await requestCorrection(report);
      await http()
        .post(`/v1/correction-requests/${id}/approve`)
        .set(manager.auth)
        .send({})
        .expect(200);
      await queue.resume();
      await waitForJobs(app);

      const statuses = (await notificationsFor(id)).map((row) => [row.type, row.status]);
      expect(statuses).toEqual([
        ["correction_submitted", "skipped"],
        ["correction_approved", "sent"],
      ]);
      expect(mailTo(manager)).toHaveLength(0);
      expect(mailTo(report)).toHaveLength(1);
    });
  });

  describe("correction decided (§18.3)", () => {
    it("tells the requester it was approved, by whom", async () => {
      const id = await requestCorrection(report);
      await http()
        .post(`/v1/correction-requests/${id}/approve`)
        .set(manager.auth)
        .send({})
        .expect(200);
      await waitForJobs(app);

      const [email] = mailTo(report);
      const managerName = (
        await prisma().user.findUniqueOrThrow({ where: { id: manager.user.id } })
      ).name;
      expect(email?.subject).toBe("Your correction for Monday, 2 November 2026 was approved");
      expect(email?.text).toContain(`${managerName} approved your correction request`);
      expect(email?.text).not.toContain("Note:");
    });

    it("tells the requester it was rejected, with the note", async () => {
      const id = await requestCorrection(report);
      await http()
        .post(`/v1/correction-requests/${id}/reject`)
        .set(hr.auth)
        .send({ decisionNote: "No evidence of work before 10:00." })
        .expect(200);
      await waitForJobs(app);

      const [email] = mailTo(report);
      expect(email?.subject).toBe("Your correction for Monday, 2 November 2026 was rejected");
      expect(email?.text).toContain("Note: No evidence of work before 10:00.");
    });

    it("sends nothing to a requester whose account was deactivated", async () => {
      const id = await requestCorrection(report);
      await prisma().user.update({
        where: { id: report.user.id },
        data: { disabledAt: new Date() },
      });
      await http()
        .post(`/v1/correction-requests/${id}/approve`)
        .set(manager.auth)
        .send({})
        .expect(200);
      await waitForJobs(app);

      expect(mailTo(report)).toHaveLength(0);
    });
  });

  describe("delivery failures (§18.1)", () => {
    it("keeps the correction, retries, and records the email failure at the end", async () => {
      const queue = app.get<Queue>(getQueueToken(NOTIFICATION_EMAILS_QUEUE));
      await queue.pause();
      const id = await requestCorrection(report); // the request itself succeeds
      const [pending] = await notificationsFor(id);
      if (!pending) throw new Error("expected a notification");

      const mailer = app.get(MailService);
      vi.spyOn(mailer, "send").mockRejectedValueOnce(new Error("SMTP down"));
      const notifications = app.get(NotificationsService);
      await expect(notifications.deliver(pending.id)).rejects.toThrow("SMTP down");
      expect((await notificationsFor(id))[0]?.status).toBe("pending"); // a retry can still send it

      await notifications.markFailed(pending.id);
      // Its in-app line was recorded before the email failed, so it still shows in the app
      const [failed] = await notificationsFor(id);
      expect(failed).toMatchObject({
        status: "sent",
        failureCode: "MAIL_DELIVERY_FAILED",
        emailedAt: null,
      });
      expect(failed?.title).toContain("asked to correct Mon 2 Nov");

      // A later retry of the job sends nothing more
      await notifications.deliver(pending.id);
      expect(mailTo(manager)).toHaveLength(0);
      await queue.obliterate({ force: true });
    });
  });
});
