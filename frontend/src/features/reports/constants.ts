// Backend src/modules/reports/reports.constants.ts

/** Completion filters: open = still before its check-out deadline, incomplete = past it. */
export const REPORT_COMPLETIONS = ["open", "incomplete", "complete", "not_applicable"] as const;
export type ReportCompletion = (typeof REPORT_COMPLETIONS)[number];
export const REPORT_COMPLETION_LABEL: Record<ReportCompletion, string> = {
  open: "Not checked out yet",
  incomplete: "Missing check-out",
  complete: "Complete",
  not_applicable: "No check-in",
};

/** Longest report range (UX_FLOWS.md §11.1). */
export const MAX_REPORT_DAYS = 366;

/** Managers see direct reports' history this many days back, today included. */
export const TEAM_HISTORY_DAYS = 90;

/** One employee's day in team views (UX_FLOWS.md §10). Derived by the server. */
export const TEAM_DAY_STATES = [
  "checked_in",
  "not_checked_out",
  "checked_out",
  "absent",
  "excused",
  "not_checked_in",
  "non_working_day",
] as const;
export type TeamDayState = (typeof TEAM_DAY_STATES)[number];

export const TEAM_DAY_STATE_LABEL: Record<TeamDayState, string> = {
  checked_in: "Checked in",
  not_checked_out: "Not checked out",
  checked_out: "Checked out",
  absent: "Absent",
  excused: "Excused",
  not_checked_in: "Not checked in",
  non_working_day: "Not a working day",
};

/** The team page's card filters (UX_FLOWS.md §10): each matches a summary count. */
export const TEAM_FILTERS = [
  "present",
  "late",
  "not_checked_in",
  "not_checked_out",
  "absent",
] as const;
export type TeamFilter = (typeof TEAM_FILTERS)[number];

/** How often team and organization counts re-check while the tab is visible. */
export const DASHBOARD_POLL_MS = 60_000;
