import { MAX_REPORT_DAYS } from "@/features/reports/constants";
import { daysBetween, firstDayOf, isIsoDate, lastDayOf, monthOf } from "@/lib/dates";

export type ReportRange = { from: string; to: string } | { error: string };

/**
 * UX_FLOWS.md §11.1 — the report's required range, checked before any request. Empty
 * bounds fall back to the current month.
 */
export function reportRange(filters: { from: string; to: string }, today: string): ReportRange {
  const month = monthOf(today);
  const from = filters.from || firstDayOf(month);
  const to = filters.to || lastDayOf(month);
  if (!isIsoDate(from) || !isIsoDate(to)) return { error: "Choose valid dates." };
  if (from > to) return { error: "The end date must be on or after the start date." };
  if (daysBetween(from, to) >= MAX_REPORT_DAYS) {
    return { error: `Choose a range of at most ${MAX_REPORT_DAYS} days.` };
  }
  return { from, to };
}
