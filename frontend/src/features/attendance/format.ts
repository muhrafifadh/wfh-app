import type { Attendance } from "@/features/attendance/schemas";
import { formatMinute } from "@/lib/attendance/format";
import { formatDuration } from "@/lib/format";
import { formatTimeIn, timeZoneLabel } from "@/lib/time-zone";

// UX_FLOWS.md §3.4 formats. Fixed locale; times are always shown in the record's zone.

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

export { formatDuration };
export {
  durationLabel,
  EMPTY,
  formatCellTime,
  formatClock,
  formatMinute,
  timesLine,
} from "@/lib/attendance/format";

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

/** "Good morning" by the organization's hour, from the server's time. */
export function greeting(serverTime: string, timeZone: string): string {
  const hour = Number(formatTimeIn(serverTime, timeZone).slice(0, 2));
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
