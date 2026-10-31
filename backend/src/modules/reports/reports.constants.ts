/** Report completion filters: the summary's buckets (open = still before its check-out deadline). */
export const REPORT_COMPLETIONS = ["open", "incomplete", "complete", "not_applicable"] as const;
export type ReportCompletion = (typeof REPORT_COMPLETIONS)[number];

/** Longest report range (UX_FLOWS.md §11.1). */
export const MAX_REPORT_DAYS = 366;

/** Managers see direct reports' history for this many days, today included (§12). */
export const TEAM_HISTORY_DAYS = 90;

/** The organization dashboard's trend covers this many working days, ending today. */
export const DASHBOARD_TREND_WORKING_DAYS = 30;

/** Rows read per query while streaming a CSV export. */
export const CSV_BATCH_SIZE = 1000;

/**
 * Status of one employee on a day in team views (UX_FLOWS.md §10). Not stored:
 * derived from the record (or its absence), the calendar and server time.
 */
export const TEAM_DAY_STATES = [
  "checked_in", // open, before the scheduled end
  "not_checked_out", // open, past the scheduled end
  "checked_out",
  "absent",
  "excused",
  "not_checked_in", // working day, no record yet (close-day hasn't marked it)
  "non_working_day",
] as const;
export type TeamDayState = (typeof TEAM_DAY_STATES)[number];
