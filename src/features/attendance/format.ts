import type { Attendance } from "@/features/attendance/schemas";
import { formatTimeIn, timeZoneLabel } from "@/lib/time-zone";

// UX_FLOWS.md §3.4 formats. Fixed locale; times are always shown in the record's zone.

export const EMPTY = "—";

const longDate = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-10-30" → "Friday, 30 October 2026" */
export const formatLongDate = (isoDate: string) =>
  longDate.format(new Date(`${isoDate}T00:00:00Z`));

const monthYear = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-10" → "October 2026" */
export const formatMonthYear = (month: string) =>
  monthYear.format(new Date(`${month}-01T00:00:00Z`));

/** 462 → "7h 42m"; 45 → "45m"; 0 → "0m" */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours === 0 ? `${rest}m` : `${hours}h ${String(rest).padStart(2, "0")}m`;
}

/** An instant for status and transactions: "08:57:12 WIB". */
export const formatClock = (isoDateTime: string, timeZone: string) =>
  `${formatTimeIn(isoDateTime, timeZone)} ${timeZoneLabel(timeZone)}`;

/** An instant as a schedule boundary or table time: "09:15 WIB" (seconds hidden). */
export const formatMinute = (isoDateTime: string, timeZone: string) =>
  `${formatTimeIn(isoDateTime, timeZone).slice(0, 5)} ${timeZoneLabel(timeZone)}`;

/** A table cell time without the zone ("08:57"); the column header names the zone. */
export const formatCellTime = (isoDateTime: string | null, timeZone: string) =>
  isoDateTime ? formatTimeIn(isoDateTime, timeZone).slice(0, 5) : EMPTY;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/**
 * UX_FLOWS.md §7.3 — factual, and from the API's lateMinutes (never recalculated):
 * "Checked in 7 minutes after the 09:15 WIB deadline."
 */
export const lateMessage = (record: Pick<Attendance, "lateMinutes" | "schedule">) =>
  `Checked in ${plural(record.lateMinutes, "minute")} after the ${formatMinute(
    record.schedule.onTimeDeadlineAt,
    record.schedule.timezone,
  )} deadline.`;

/** "09:00–17:00 WIB · 15 min tolerance" from today's boundaries. */
export function scheduleLine(schedule: Attendance["schedule"]): string {
  const { timezone } = schedule;
  const start = formatTimeIn(schedule.scheduledStartAt, timezone).slice(0, 5);
  const end = formatTimeIn(schedule.scheduledEndAt, timezone).slice(0, 5);
  const tolerance = Math.round(
    (Date.parse(schedule.onTimeDeadlineAt) - Date.parse(schedule.scheduledStartAt)) / 60_000,
  );
  return `${start}–${end} ${timeZoneLabel(timezone)} · ${tolerance} min tolerance`;
}

/** What an attendance row shows for duration: never a made-up number for open records. */
export function durationLabel(
  record: Pick<Attendance, "status" | "completion" | "incomplete" | "workedMinutes">,
): string {
  if (record.workedMinutes !== null) return formatDuration(record.workedMinutes);
  if (record.completion === "open")
    return record.incomplete ? "Missing check-out" : "Not checked out";
  return EMPTY;
}

/**
 * A record's times on one line: "08:52–17:32 WIB · 8h 40m", "17:39 WIB · Not checked out",
 * or "No check-in" for an absence.
 */
export function timesLine(
  record: Pick<
    Attendance,
    | "checkInAt"
    | "checkOutAt"
    | "status"
    | "completion"
    | "incomplete"
    | "workedMinutes"
    | "schedule"
  >,
): string {
  const zone = record.schedule.timezone;
  if (!record.checkInAt) return "No check-in";
  const times = record.checkOutAt
    ? `${formatCellTime(record.checkInAt, zone)}–${formatCellTime(record.checkOutAt, zone)}`
    : formatCellTime(record.checkInAt, zone);
  return `${times} ${timeZoneLabel(zone)} · ${durationLabel(record)}`;
}

/** "Good morning" by the organization's hour, from the server's time. */
export function greeting(serverTime: string, timeZone: string): string {
  const hour = Number(formatTimeIn(serverTime, timeZone).slice(0, 2));
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
