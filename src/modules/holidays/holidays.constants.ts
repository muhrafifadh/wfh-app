/** Longest range GET /work-calendar returns in one call. */
export const MAX_CALENDAR_DAYS = 62;

/** Why a day isn't a working day. */
export const NON_WORKING_REASONS = ["no_schedule", "non_working_day", "holiday"] as const;
export type NonWorkingReason = (typeof NON_WORKING_REASONS)[number];
