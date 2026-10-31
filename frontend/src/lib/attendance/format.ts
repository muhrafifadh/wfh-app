import type { Attendance } from "@/lib/attendance/schemas";
import { formatDuration } from "@/lib/format";
import { formatTimeIn, timeZoneLabel } from "@/lib/time-zone";

// UX_FLOWS.md §3.4 formats for attendance records, shared by every feature that lists them.
// Times are always shown in the record's own zone.

export const EMPTY = "—";

/** An instant for status and transactions: "08:57:12 WIB". */
export const formatClock = (isoDateTime: string, timeZone: string) =>
  `${formatTimeIn(isoDateTime, timeZone)} ${timeZoneLabel(timeZone)}`;

/** An instant as a schedule boundary or table time: "09:15 WIB" (seconds hidden). */
export const formatMinute = (isoDateTime: string, timeZone: string) =>
  `${formatTimeIn(isoDateTime, timeZone).slice(0, 5)} ${timeZoneLabel(timeZone)}`;

/** A table cell time without the zone ("08:57"); the column header names the zone. */
export const formatCellTime = (isoDateTime: string | null, timeZone: string) =>
  isoDateTime ? formatTimeIn(isoDateTime, timeZone).slice(0, 5) : EMPTY;

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
