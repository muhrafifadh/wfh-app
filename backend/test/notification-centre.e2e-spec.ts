import { randomUUID } from "node:crypto";

import { getQueueToken } from "@nestjs/bullmq";
import type { NestExpressApplication } from "@nestjs/platform-express";

import type { Queue } from "bullmq";
import request from "supertest";

import type { Permission } from "@/common/types/auth.js";
import { MailService, type MailMessage } from "@/infra/mail/mail.service.js";
import { MemoryMailer } from "@/infra/mail/mailers.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import { NOTIFICATION_EMAILS_QUEUE } from "@/modules/notifications/jobs/notification-emails.queue.js";

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

type Person = { user: TestUser; employee: { id: string }; auth: { Authorization: string } };

describe("Notification centre (e2e, DOMAIN_RULES.md §18.6–18.7)", () => {
  let app: NestExpressApplication;
  let owner: TestUser;
  let divisionId: string;
  let manager: Person;
  let report: Person;
  let report2: Person;

  const http = () => request(app.getHttpServer());
  const at = (date: string, time: string) => clockOf(app).set(wib(date, time));
  const mailbox = (): MailMessage[] => {
    const mailer = app.get(MailService);
    if (!(mailer instanceof MemoryMailer)) throw new Error("tests expect MAIL_TRANSPORT=memory");
    return mailer.sent;
  };
  const list = (who: Person, query = "") =>
    http().get(`/v1/notifications/me${query}`).set(who.auth).expect(200);
  const unread = async (who: Person) =>
    (await http().get("/v1/notifications/me/unread-count").set(who.auth).expect(200)).body.count;

  const person = async (permissions: Permission[], managerId?: string): Promise<Person> => {
    const user = await createUser(app, {
      permissions: ["attendance:self", "correction:submit", ...permissions],
      sameOrganizationAs: owner,
    });
    const employee = await createEmployee(app, user, { divisionId, userId: user.id, managerId });
    return { user, employee, auth: await authHeader(app, user) };
  };

  /** A forgotten check-out on Monday, corrected on Tuesday. Returns the request id. */
  const requestCorrection = async (who: Person): Promise<string> => {
    at(MONDAY, "09:30:00");
    const checkIn = await http()
      .post("/v1/attendance/check-in")
      .set(who.auth)
      .set("Idempotency-Key", randomUUID())
      .expect(201);
    at(TUESDAY, "10:00:00");
    const res = await http()
      .post("/v1/correction-requests")
      .set(who.auth)
      .send({
        attendanceId: checkIn.body.id,
        requestedCheckInAt: wib(MONDAY, "09:00:00"),
        requestedCheckOutAt: wib(MONDAY, "17:00:00"),
        reason: "Forgot to check out, worked until 17:00.",
      })
      .expect(201);
    return res.body.id as string;
  };

  beforeEach(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    owner = await createUser(app);
    divisionId = (await createDivision(app, owner)).id;
    await createSchedule(app, owner);
    manager = await person(["correction:decide_team"]);
    report = await person([], manager.employee.id);
    report2 = await person([], manager.employee.id);
  });

  afterEach(async () => {
    await app.close();
  });

  describe("the list (§18.6)", () => {
    it("shows each user only their own delivered notifications, with a title and link", async () => {
      const id = await requestCorrection(report);
      await waitForJobs(app);

      const res = await list(manager);
      expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 1 });
      expect(res.body.items).toEqual([
        {
          id: expect.any(String),
          type: "correction_submitted",
          title: expect.stringMatching(/^Employee \d+ asked to correct Mon 2 Nov$/),
          link: `/corrections/${id}`,
          deliveredAt: expect.any(String),
          readAt: null,
        },
      ]);
      expect(await unread(manager)).toBe(1);
      expect((await list(report)).body.total).toBe(0);
    });

    it("marks one read, idempotently; someone else's is not found", async () => {
      await requestCorrection(report);
      await waitForJobs(app);
      const [item] = (await list(manager)).body.items;

      await http().post(`/v1/notifications/${item.id}/read`).set(manager.auth).expect(204);
      await http().post(`/v1/notifications/${item.id}/read`).set(manager.auth).expect(204);
      expect(await unread(manager)).toBe(0);
      expect((await list(manager)).body.items[0].readAt).not.toBeNull();

      await http().post(`/v1/notifications/${item.id}/read`).set(report.auth).expect(404);
      await http().post(`/v1/notifications/${randomUUID()}/read`).set(manager.auth).expect(404);
      await http().post("/v1/notifications/not-a-uuid/read").set(manager.auth).expect(400);
    });

    it("filters unread ones and marks them all read", async () => {
      await requestCorrection(report);
      await requestCorrection(report2);
      await waitForJobs(app);
      expect((await list(manager, "?unread=true")).body.total).toBe(2);

      const res = await http().post("/v1/notifications/me/read-all").set(manager.auth).expect(200);
      expect(res.body).toEqual({ updated: 2 });
      expect(await unread(manager)).toBe(0);
      expect((await list(manager, "?unread=true")).body.total).toBe(0);
      expect((await list(manager)).body.total).toBe(2);
    });

    it("never lists a skipped notification", async () => {
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

      expect((await list(manager)).body.total).toBe(0);
      const mine = await list(report);
      expect(mine.body.items.map((item: { title: string }) => item.title)).toEqual([
        "Your correction for Mon 2 Nov was approved",
      ]);
    });

    it("needs a signed-in user", async () => {
      await http().get("/v1/notifications/me").expect(401);
      await http().get("/v1/notifications/preferences").expect(401);
    });
  });

  describe("email preferences (§18.7)", () => {
    it("are all on by default", async () => {
      const res = await http().get("/v1/notifications/preferences").set(manager.auth).expect(200);
      expect(res.body).toEqual({
        reviewRequestsEmail: true,
        correctionUpdatesEmail: true,
        checkInReminderEmail: true,
        checkOutReminderEmail: true,
      });
    });

    it("turning an email off keeps the in-app item", async () => {
      const prefs = {
        reviewRequestsEmail: false,
        correctionUpdatesEmail: true,
        checkInReminderEmail: true,
        checkOutReminderEmail: true,
      };
      const res = await http()
        .put("/v1/notifications/preferences")
        .set(manager.auth)
        .send(prefs)
        .expect(200);
      expect(res.body).toEqual(prefs);

      const id = await requestCorrection(report);
      await waitForJobs(app);
      expect(mailbox().filter((m) => m.to === manager.user.email)).toHaveLength(0);
      expect((await list(manager)).body.total).toBe(1);
      const row = await app
        .get(PrismaService)
        .notification.findFirstOrThrow({ where: { subjectId: id } });
      expect(row).toMatchObject({ status: "sent", emailedAt: null });

      // Another user's preferences are untouched
      await http()
        .post(`/v1/correction-requests/${id}/approve`)
        .set(manager.auth)
        .send({})
        .expect(200);
      await waitForJobs(app);
      expect(mailbox().filter((m) => m.to === report.user.email)).toHaveLength(1);
    });

    it("must send all four, and nothing else", async () => {
      await http()
        .put("/v1/notifications/preferences")
        .set(manager.auth)
        .send({ reviewRequestsEmail: false })
        .expect(400);
      await http()
        .put("/v1/notifications/preferences")
        .set(manager.auth)
        .send({
          reviewRequestsEmail: true,
          correctionUpdatesEmail: true,
          checkInReminderEmail: true,
          checkOutReminderEmail: true,
          userId: report.user.id,
        })
        .expect(400);
    });
  });
});
