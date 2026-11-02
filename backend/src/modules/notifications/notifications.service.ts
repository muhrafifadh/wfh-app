import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";

import type { Queue } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import { EmployeeDirectory, UserDirectory, type Contact } from "@/common/contracts/directory.js";
import type { Paginated } from "@/common/dto/pagination.js";
import { NotFoundError } from "@/common/errors/app-error.js";
import { fromDateColumn, toDateColumn, type LocalDate } from "@/common/time/zoned-time.js";
import type { AuthUser } from "@/common/types/auth.js";
import { AppConfig } from "@/config/config.module.js";
import { Clock } from "@/infra/clock/clock.js";
import { MailService } from "@/infra/mail/mail.service.js";
import { CLOSE_DAY_BATCH_SIZE } from "@/modules/attendance/attendance.constants.js";
import { AttendanceService } from "@/modules/attendance/attendance.service.js";
import {
  CorrectionsService,
  type CorrectionNotice,
} from "@/modules/corrections/corrections.service.js";
import { HolidaysService } from "@/modules/holidays/holidays.service.js";
import {
  correctionDecidedEmail,
  correctionReviewers,
  correctionSubmittedEmail,
  dedupeKeyOf,
  type CorrectionNotificationType,
  type EmailContent,
  type NotificationType,
} from "@/modules/notifications/domain/notification-rules.js";
import {
  checkInReminderEmail,
  checkOutReminderEmail,
  needsReminder,
  REMINDER_TYPE,
  reminderDue,
  reminderKeyOf,
  type ReminderKind,
} from "@/modules/notifications/domain/reminder-rules.js";
import type { ListNotificationsQueryInput } from "@/modules/notifications/dto/list-notifications.query.js";
import type { NotificationResponseBody } from "@/modules/notifications/dto/notification.response.js";
import {
  NOTIFICATION_EMAIL_JOB,
  NOTIFICATION_EMAILS_QUEUE,
  notificationEmailJobId,
  type NotificationEmailJob,
} from "@/modules/notifications/jobs/notification-emails.queue.js";
import {
  NotificationsRepository,
  type EmailPreferences,
  type NotificationInsert,
} from "@/modules/notifications/notifications.repository.js";
import { boundariesFor } from "@/modules/work-settings/domain/schedule-policy.js";
import { WorkSettingsService } from "@/modules/work-settings/work-settings.service.js";

/** Safe code stored when the last delivery attempt failed (§18.1). */
export const MAIL_DELIVERY_FAILED = "MAIL_DELIVERY_FAILED";

/** §18.5 — notifications are kept this long. */
export const NOTIFICATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

const REMINDER_KINDS: ReminderKind[] = ["check_in", "check_out"];

type StoredNotification = NonNullable<Awaited<ReturnType<NotificationsRepository["findById"]>>>;

/** What delivery needs: the email (with its in-app title) and the app path. */
type Content = { email: EmailContent; path: string };

/** §18.7 — which email preference covers each type. */
const PREFERENCE_OF: Record<NotificationType, keyof EmailPreferences> = {
  correction_submitted: "reviewRequestsEmail",
  correction_approved: "correctionUpdatesEmail",
  correction_rejected: "correctionUpdatesEmail",
  reminder_check_in: "checkInReminderEmail",
  reminder_check_out: "checkOutReminderEmail",
};

const DEFAULT_PREFERENCES: EmailPreferences = {
  reviewRequestsEmail: true,
  correctionUpdatesEmail: true,
  checkInReminderEmail: true,
  checkOutReminderEmail: true,
};

/**
 * DOMAIN_RULES.md §18 — creates notifications after the action that caused them has
 * committed, and delivers them by email from a job. Each step is safe to repeat.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly repo: NotificationsRepository,
    private readonly corrections: CorrectionsService,
    private readonly employees: EmployeeDirectory,
    private readonly users: UserDirectory,
    private readonly attendance: AttendanceService,
    private readonly workSettings: WorkSettingsService,
    private readonly holidays: HolidaysService,
    private readonly mail: MailService,
    private readonly clock: Clock,
    private readonly config: AppConfig,
    private readonly logger: PinoLogger,
    @InjectQueue(NOTIFICATION_EMAILS_QUEUE) private readonly emails: Queue<NotificationEmailJob>,
  ) {
    this.logger.setContext(NotificationsService.name);
  }

  // Creating

  /** §18.2 — the direct manager, or everyone who decides any correction. */
  async correctionSubmitted(organizationId: string, correctionId: string): Promise<void> {
    const correction = await this.corrections.findForNotification(organizationId, correctionId);
    if (!correction || correction.status !== "pending") return;

    const line = await this.employees.reportingLineOf(organizationId, correction.employeeId);
    const [manager] = line?.managerUserId
      ? await this.users.contactsByIds(organizationId, [line.managerUserId])
      : [];
    const recipients = correctionReviewers({
      requesterId: correction.requestedById,
      manager: manager ?? null,
      deciders: await this.users.contactsWithPermission(organizationId, "correction:decide_all"),
    });
    await this.create(organizationId, "correction_submitted", correctionId, recipients);
  }

  /** §18.3 — the requester hears the outcome. */
  async correctionDecided(organizationId: string, correctionId: string): Promise<void> {
    const correction = await this.corrections.findForNotification(organizationId, correctionId);
    if (!correction || correction.status === "pending") return;
    const recipients = await this.users.contactsByIds(organizationId, [correction.requestedById]);
    const type = correction.status === "approved" ? "correction_approved" : "correction_rejected";
    await this.create(organizationId, type, correctionId, recipients);
  }

  private async create(
    organizationId: string,
    type: CorrectionNotificationType,
    subjectId: string,
    recipients: Contact[],
  ): Promise<void> {
    await this.insertAndQueue(
      recipients.map((recipient) => ({
        organizationId,
        recipientId: recipient.id,
        type,
        subjectId,
        dedupeKey: dedupeKeyOf(type, subjectId, recipient.id),
      })),
    );
  }

  /** Inserts the new ones and queues one email job each. Returns how many were new. */
  private async insertAndQueue(rows: NotificationInsert[]): Promise<number> {
    const ids = await this.repo.insertNew(rows);
    if (ids.length === 0) return 0;
    await this.emails.addBulk(
      ids.map((notificationId) => ({
        name: NOTIFICATION_EMAIL_JOB,
        data: { notificationId },
        opts: { jobId: notificationEmailJobId(notificationId) },
      })),
    );
    return ids.length;
  }

  // Reminders (§18.4)

  /** The scheduled check: creates every reminder due now, in every organization. */
  async createDueReminders(now: Date): Promise<number> {
    let created = 0;
    for (const organizationId of await this.workSettings.organizationIds()) {
      try {
        created += await this.createRemindersFor(organizationId, now);
      } catch (error) {
        // One organization's failure doesn't stop the others; the next check retries it
        this.logger.error({ err: error, organizationId }, "Creating reminders failed");
      }
    }
    return created;
  }

  async createRemindersFor(organizationId: string, now: Date): Promise<number> {
    const today = await this.workSettings.today(organizationId, now);
    const day = await this.holidays.isWorkingDay(organizationId, today.workDate);
    if (!day.isWorkingDay || !day.schedule) return 0;

    const settings = await this.workSettings.reminderSettingsOf(organizationId);
    const boundaries = boundariesFor(day.schedule, today.workDate);
    const due = REMINDER_KINDS.flatMap((kind) => {
      const window = reminderDue({
        kind,
        setting: kind === "check_in" ? settings.checkIn : settings.checkOut,
        boundaries,
        timezone: day.schedule?.timezone ?? today.timezone,
        now,
      });
      return window ? [{ kind, expiresAt: window.expiresAt }] : [];
    });
    if (due.length === 0) return 0;

    let created = 0;
    let afterId: string | null = null;
    for (;;) {
      const ids = await this.employees.eligibleIdsOn(
        organizationId,
        today.workDate,
        afterId,
        CLOSE_DAY_BATCH_SIZE,
      );
      if (ids.length === 0) break;
      afterId = ids.at(-1) ?? null;

      const [times, accounts] = await Promise.all([
        this.attendance.timesOn(organizationId, today.workDate, ids),
        this.employees.accountsOf(organizationId, ids),
      ]);
      const contacts = new Set(
        (await this.users.contactsByIds(organizationId, [...accounts.values()])).map((c) => c.id),
      );
      const rows = due.flatMap(({ kind, expiresAt }) =>
        ids.flatMap((employeeId): NotificationInsert[] => {
          const recipientId = accounts.get(employeeId);
          if (!recipientId || !contacts.has(recipientId)) return [];
          if (!needsReminder(kind, times.get(employeeId))) return [];
          const type = REMINDER_TYPE[kind];
          return [
            {
              organizationId,
              recipientId,
              type,
              subjectId: employeeId,
              dedupeKey: reminderKeyOf(type, employeeId, today.workDate),
              workDate: toDateColumn(today.workDate),
              expiresAt,
            },
          ];
        }),
      );
      created += await this.insertAndQueue(rows);
    }
    if (created > 0) {
      this.logger.info({ organizationId, workDate: today.workDate, created }, "Reminders created");
    }
    return created;
  }

  /** §18.5 — deletes notifications older than the retention period. */
  async purgeExpired(now: Date): Promise<number> {
    return this.repo.deleteCreatedBefore(new Date(now.getTime() - NOTIFICATION_RETENTION_MS));
  }

  // Delivering

  /**
   * Delivers one pending notification, built from current data: records its in-app
   * line, emails it if the recipient wants that email (§18.7), then marks it sent.
   * Skips it when it no longer applies (recipient gone, request already decided,
   * reminder no longer needed). A sent or skipped one is left alone, so a retry
   * never sends twice.
   */
  async deliver(notificationId: string): Promise<void> {
    const notification = await this.repo.findById(notificationId);
    if (!notification || notification.status !== "pending") return;

    const { organizationId, recipientId, type } = notification;
    const [recipient] = await this.users.contactsByIds(organizationId, [recipientId]);
    const content = recipient ? await this.contentFor(notification, recipient) : null;
    if (!recipient || !content) {
      await this.repo.finish(notificationId, { status: "skipped" });
      this.logger.info({ notificationId, type }, "Notification skipped");
      return;
    }

    const { email, path } = content;
    await this.repo.setContent(notificationId, email.title, path);
    const wantsEmail = (await this.preferencesOf(recipientId))[PREFERENCE_OF[type]];
    if (wantsEmail) await this.mail.send({ to: recipient.email, ...email });
    const now = this.clock.now();
    await this.repo.finish(notificationId, {
      status: "sent",
      sentAt: now,
      ...(wantsEmail && { emailedAt: now }),
    });
    this.logger.info({ notificationId, type, emailed: wantsEmail }, "Notification delivered");
  }

  /**
   * After the last delivery attempt failed (the processor's failed handler). If its
   * in-app line was recorded, it still shows in the app, with the email failure noted.
   */
  async markFailed(notificationId: string): Promise<void> {
    const notification = await this.repo.findById(notificationId);
    if (!notification) return;
    await this.repo.finish(
      notificationId,
      notification.title
        ? { status: "sent", sentAt: this.clock.now(), failureCode: MAIL_DELIVERY_FAILED }
        : { status: "failed", failureCode: MAIL_DELIVERY_FAILED },
    );
  }

  // The user's own list (§18.6)

  async listMine(
    user: AuthUser,
    query: ListNotificationsQueryInput,
  ): Promise<Paginated<NotificationResponseBody>> {
    const { rows, total } = await this.repo.listDelivered(user.id, query);
    return {
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title ?? "Notification",
        link: row.link,
        deliveredAt: (row.sentAt ?? new Date(0)).toISOString(),
        readAt: row.readAt?.toISOString() ?? null,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  async unreadCount(user: AuthUser): Promise<{ count: number }> {
    return { count: await this.repo.countUnread(user.id) };
  }

  /** Idempotent; someone else's notification is not found. */
  async markRead(user: AuthUser, id: string): Promise<void> {
    if (!(await this.repo.markRead(id, user.id, this.clock.now()))) {
      throw new NotFoundError("Notification");
    }
  }

  async markAllRead(user: AuthUser): Promise<{ updated: number }> {
    return { updated: await this.repo.markAllRead(user.id, this.clock.now()) };
  }

  // Email preferences (§18.7)

  async preferencesOf(userId: string): Promise<EmailPreferences> {
    return (await this.repo.findPreferences(userId)) ?? DEFAULT_PREFERENCES;
  }

  async updatePreferences(user: AuthUser, input: EmailPreferences): Promise<EmailPreferences> {
    return this.repo.upsertPreferences(user.id, input);
  }

  /** The email and app path for this notification, or null when it no longer applies. */
  private async contentFor(
    notification: StoredNotification,
    recipient: Contact,
  ): Promise<Content | null> {
    const { type, organizationId, subjectId } = notification;
    if (type === "reminder_check_in" || type === "reminder_check_out") {
      return this.reminderContent(notification, recipient);
    }
    const correction = await this.corrections.findForNotification(organizationId, subjectId);
    return correction && this.correctionContent(organizationId, type, recipient, correction);
  }

  /** §18.4 — re-checked: not after it expires, and only if the action is still needed. */
  private async reminderContent(
    notification: StoredNotification,
    recipient: Contact,
  ): Promise<Content | null> {
    const { organizationId, subjectId: employeeId, workDate, expiresAt } = notification;
    if (!workDate || !expiresAt || this.clock.now() >= expiresAt) return null;
    const date = fromDateColumn(workDate);
    const kind: ReminderKind = notification.type === "reminder_check_in" ? "check_in" : "check_out";
    const record = (await this.attendance.timesOn(organizationId, date, [employeeId])).get(
      employeeId,
    );
    if (!needsReminder(kind, record)) return null;

    const timezone = await this.timezoneOn(organizationId, date);
    const path = "/attendance";
    const base = {
      recipientName: recipient.name,
      workDate: date,
      closesAt: expiresAt,
      timezone,
      link: this.urlOf(path),
    };
    const email =
      kind === "check_in" || !record?.checkInAt
        ? checkInReminderEmail(base)
        : checkOutReminderEmail({ ...base, checkInAt: record.checkInAt });
    return { email, path };
  }

  /** The zone of the schedule in force on that date (or the organization's default). */
  private async timezoneOn(organizationId: string, date: LocalDate): Promise<string> {
    const schedule = await this.workSettings.scheduleOn(organizationId, date);
    return (
      schedule?.timezone ??
      (await this.workSettings.today(organizationId, this.clock.now())).timezone
    );
  }

  private urlOf(path: string): string {
    return new URL(path, this.config.get("FRONTEND_URL")).toString();
  }

  private async correctionContent(
    organizationId: string,
    type: CorrectionNotificationType,
    recipient: Contact,
    correction: CorrectionNotice,
  ): Promise<Content | null> {
    const path = `/corrections/${correction.id}`;
    const link = this.urlOf(path);
    if (type === "correction_submitted") {
      // Decided before its turn came: nothing left to review
      if (correction.status !== "pending") return null;
      const line = await this.employees.reportingLineOf(organizationId, correction.employeeId);
      if (!line) return null;
      const email = correctionSubmittedEmail({
        recipientName: recipient.name,
        employeeName: line.fullName,
        workDate: correction.workDate,
        link,
      });
      return { email, path };
    }

    const decision = type === "correction_approved" ? "approved" : "rejected";
    if (correction.status !== decision || !correction.decidedById) return null;
    const names = await this.users.namesByIds(organizationId, [correction.decidedById]);
    const email = correctionDecidedEmail({
      recipientName: recipient.name,
      decision,
      deciderName: names.get(correction.decidedById) ?? "Your reviewer",
      workDate: correction.workDate,
      note: correction.decisionNote,
      link,
    });
    return { email, path };
  }
}
