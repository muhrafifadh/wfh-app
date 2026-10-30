import { CORRECTION_WINDOW_DAYS } from "@/features/attendance/constants";
import type { Attendance } from "@/features/attendance/schemas";
import type { HistoryFilters } from "@/features/attendance/search-params";

// Calendar arithmetic on work dates ("2026-10-30") and months ("2026-10"). "Today" always
// comes from the server (the organization's workDate), never from the browser's clock.

/** The backend's longest history range (attendance.constants.ts MAX_RANGE_DAYS). */
export const MAX_RANGE_DAYS = 366;

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const toUtc = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);
const fromUtc = (date: Date) => date.toISOString().slice(0, 10);

/** A real calendar date ("2026-02-30" is not). */
export const isIsoDate = (value: string) => DATE.test(value) && fromUtc(toUtc(value)) === value;
export const isIsoMonth = (value: string) => MONTH.test(value);

export const addDays = (isoDate: string, days: number) => {
  const date = toUtc(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
};

export const daysBetween = (from: string, to: string) =>
  Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);

export const monthOf = (isoDate: string) => isoDate.slice(0, 7);
export const firstDayOf = (month: string) => `${month}-01`;
export const lastDayOf = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return fromUtc(new Date(Date.UTC(year, monthNumber, 0)));
};

export const shiftMonth = (month: string, by: number) => {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return fromUtc(new Date(Date.UTC(year, monthNumber - 1 + by, 1))).slice(0, 7);
};

/** Mon = 1 … Sun = 7, like the schedule's working days. */
export const isoWeekday = (isoDate: string) => toUtc(isoDate).getUTCDay() || 7;

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
