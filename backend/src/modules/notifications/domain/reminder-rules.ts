import { formatZoned, zonedToUtc, type LocalDate } from "@/common/time/zoned-time.js";
import {
  formatShortWorkDate,
  formatWorkDate,
  type EmailContent,
  type NotificationType,
} from "@/modules/notifications/domain/notification-rules.js";
import type { ScheduleBoundaries } from "@/modules/work-settings/domain/schedule-policy.js";

/** DOMAIN_RULES.md §18.4 — pure rules for check-in and check-out reminders. */

export type ReminderKind = "check_in" | "check_out";
export type ReminderType = Extract<NotificationType, `reminder_${string}`>;

export const REMINDER_TYPE: Record<ReminderKind, ReminderType> = {
  check_in: "reminder_check_in",
  check_out: "reminder_check_out",
};

/** A reminder isn't sent more than this long after its time (a server that was down). */
export const REMINDER_GRACE_MS = 2 * 60 * 60 * 1000;

/** "{type}:{employeeId}:{workDate}": one of each kind per employee per work date. */
export const reminderKeyOf = (type: ReminderType, employeeId: string, workDate: LocalDate) =>
  `${type}:${employeeId}:${workDate}`;

/**
 * Whether a reminder is due now on a working day, and until when it may be sent
 * (check-in close or the check-out deadline). Null when it isn't due.
 */
export function reminderDue(input: {
  kind: ReminderKind;
  setting: { enabled: boolean; at: number };
  boundaries: ScheduleBoundaries;
  timezone: string;
  now: Date;
}): { expiresAt: Date } | null {
  const { kind, setting, boundaries, now } = input;
  if (!setting.enabled) return null;
  const at = zonedToUtc(boundaries.workDate, setting.at, input.timezone);
  // Check-in: a time before the window opens counts from the moment it opens
  const startsAt =
    kind === "check_in" && at < boundaries.checkInOpensAt ? boundaries.checkInOpensAt : at;
  const expiresAt = kind === "check_in" ? boundaries.checkInClosesAt : boundaries.checkOutClosesAt;
  if (now < startsAt || now.getTime() >= startsAt.getTime() + REMINDER_GRACE_MS) return null;
  if (now >= expiresAt) return null;
  return { expiresAt };
}

/** Who still needs it, from their record on that date (undefined: no record). */
export function needsReminder(
  kind: ReminderKind,
  record: { checkInAt: Date | null; checkOutAt: Date | null } | undefined,
): boolean {
  if (kind === "check_in") return record === undefined;
  return record !== undefined && record.checkInAt !== null && record.checkOutAt === null;
}

const ZONE_NAMES: Record<string, string> = {
  "Asia/Jakarta": "WIB",
  "Asia/Pontianak": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

/** "17:00 WIB"; zones without a local name show their offset ("17:00 GMT+8"). */
export function formatClock(instant: Date, timeZone: string): string {
  const time = formatZoned(instant, timeZone).slice(11, 16);
  const zone =
    ZONE_NAMES[timeZone] ??
    new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "short" })
      .formatToParts(instant)
      .find((part) => part.type === "timeZoneName")?.value ??
    timeZone;
  return `${time} ${zone}`;
}

export function checkInReminderEmail(input: {
  recipientName: string;
  workDate: LocalDate;
  closesAt: Date;
  timezone: string;
  link: string;
}): EmailContent {
  const day = formatWorkDate(input.workDate);
  return {
    title: `You haven't checked in for ${formatShortWorkDate(input.workDate)}`,
    subject: "Reminder: you haven't checked in today",
    text: [
      `Hi ${input.recipientName},`,
      "",
      `You haven't checked in for ${day} yet. Check-in closes at ${formatClock(input.closesAt, input.timezone)}.`,
      `Check in: ${input.link}`,
      "",
      "You get this reminder on working days when you haven't checked in by the reminder time.",
    ].join("\n"),
  };
}

export function checkOutReminderEmail(input: {
  recipientName: string;
  workDate: LocalDate;
  checkInAt: Date;
  closesAt: Date;
  timezone: string;
  link: string;
}): EmailContent {
  const day = formatWorkDate(input.workDate);
  return {
    title: `You haven't checked out for ${formatShortWorkDate(input.workDate)}`,
    subject: "Reminder: check out when you finish work",
    text: [
      `Hi ${input.recipientName},`,
      "",
      `You checked in at ${formatClock(input.checkInAt, input.timezone)} on ${day} and haven't checked out yet.`,
      `Check out when you finish; check-out closes at ${formatClock(input.closesAt, input.timezone)}. After that, a forgotten check-out needs a correction request.`,
      `Check out: ${input.link}`,
    ].join("\n"),
  };
}
