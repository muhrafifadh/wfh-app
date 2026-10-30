// Backend src/modules/attendance/attendance.constants.ts and holidays.constants.ts

export const ATTENDANCE_STATUSES = ["present", "late", "absent", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_COMPLETIONS = ["open", "complete", "not_applicable"] as const;
export const ATTENDANCE_SOURCES = ["self_service", "close_day_job"] as const;

/** What GET /attendance/today says the card shows (UX_FLOWS.md §7.2). The server decides. */
export const TODAY_STATES = [
  "no_profile",
  "inactive",
  "non_working_day",
  "before_window",
  "ready_to_check_in",
  "window_closed",
  "checked_in",
  "check_out_closed",
  "checked_out",
] as const;
export type TodayState = (typeof TODAY_STATES)[number];

export const NON_WORKING_REASONS = ["no_schedule", "non_working_day", "holiday"] as const;

/** The statuses My History filters by (UX_FLOWS.md §8.1). "Incomplete" is a completion. */
export const HISTORY_STATUSES = ["present", "late", "absent", "incomplete"] as const;
export type HistoryStatus = (typeof HISTORY_STATUSES)[number];
export const HISTORY_STATUS_LABEL: Record<HistoryStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  incomplete: "Incomplete",
};

export const HISTORY_VIEWS = ["daily", "monthly"] as const;

/** Corrections can be submitted until the end of the seventh day after the work date. */
export const CORRECTION_WINDOW_DAYS = 7;

/** How often today's card re-checks while the tab is visible. */
export const TODAY_POLL_MS = 5 * 60_000;
