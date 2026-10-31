export const ATTENDANCE_STATUSES = ["present", "late", "absent", "excused"] as const;
export const ATTENDANCE_COMPLETIONS = ["open", "complete", "not_applicable"] as const;
export const ATTENDANCE_SOURCES = ["self_service", "close_day_job"] as const;

/**
 * GET /attendance/today → what the attendance card shows (UX_FLOWS.md §7.2).
 * The server decides; the browser only renders.
 */
export const TODAY_STATES = [
  "no_profile", // J: no employee profile
  "inactive", // J: profile inactive, or outside the employment period
  "non_working_day", // G: weekend, holiday, or no schedule
  "before_window", // B
  "ready_to_check_in", // C
  "window_closed", // H
  "checked_in", // E: ready to check out
  "check_out_closed", // I: checked in, check-out deadline passed
  "checked_out", // F
] as const;
export type TodayState = (typeof TODAY_STATES)[number];

/** How long a successful check-in/out result is replayed for its Idempotency-Key. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** Visible ASCII without spaces, e.g. a UUID. */
export const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7e]{1,128}$/;

/** Employees per close-day insert batch. */
export const CLOSE_DAY_BATCH_SIZE = 200;

/** Close-day for a date starts this long after local midnight (§10: 00:05). */
export const CLOSE_DAY_DELAY_MS = 5 * 60_000;

/** Longest range for own history filters and summaries. */
export const MAX_RANGE_DAYS = 366;
