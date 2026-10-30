import { CORRECTION_WINDOW_DAYS } from "@/features/attendance/constants";
import type { Attendance } from "@/features/attendance/schemas";
import type { HistoryFilters } from "@/features/attendance/search-params";
import {
  addDays,
  daysBetween,
  firstDayOf,
  isIsoDate,
  isIsoMonth,
  isoWeekday,
  lastDayOf,
  monthOf,
} from "@/lib/dates";

// Calendar arithmetic on work dates ("2026-10-30") and months ("2026-10"). "Today" always
// comes from the server (the organization's workDate), never from the browser's clock.

/** The backend's longest history range (attendance.constants.ts MAX_RANGE_DAYS). */
export const MAX_RANGE_DAYS = 366;

export {
  addDays,
  daysBetween,
  firstDayOf,
  isIsoDate,
  isIsoMonth,
  isoWeekday,
  lastDayOf,
  monthOf,
  shiftMonth,
} from "@/lib/dates";

/** A month as Monday-first weeks; days outside the month are null. */
export function monthWeeks(month: string): (string | null)[][] {
  const first = firstDayOf(month);
  const days = daysBetween(first, lastDayOf(month)) + 1;
  const cells: (string | null)[] = [
    ...Array.from({ length: isoWeekday(first) - 1 }, () => null),
    ...Array.from({ length: days }, (_, i) => addDays(first, i)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

export type HistoryRange = { from: string; to: string } | { error: string };

/**
 * UX_FLOWS.md §8.3 — the daily view's range, checked before any request. An empty
 * bound falls back to the current month's start or end.
 */
export function historyRange(
  filters: Pick<HistoryFilters, "from" | "to">,
  today: string,
): HistoryRange {
  const month = monthOf(today);
  const from = filters.from || firstDayOf(month);
  const to = filters.to || lastDayOf(month);
  if (!isIsoDate(from) || !isIsoDate(to)) return { error: "Choose valid dates." };
  if (from > to) return { error: "The end date must be on or after the start date." };
  if (daysBetween(from, to) >= MAX_RANGE_DAYS) {
    return { error: `Choose a range of at most ${MAX_RANGE_DAYS} days.` };
  }
  return { from, to };
}

/** The monthly view's month: the URL's when valid, else the current one. */
export const historyMonth = (requested: string, today: string) =>
  isIsoMonth(requested) ? requested : monthOf(today);

/** The last day a correction can be requested (DOMAIN_RULES.md §11.2). */
export const correctionDeadline = (workDate: string) => addDays(workDate, CORRECTION_WINDOW_DAYS);

/**
 * Whether to offer "Request correction": no request pending and within the window.
 * The backend decides; this only avoids offering what it would refuse.
 */
export const canRequestCorrection = (
  record: Pick<Attendance, "workDate" | "pendingCorrectionId">,
  today: string,
) => record.pendingCorrectionId === null && today <= correctionDeadline(record.workDate);
