export const SCHEDULE_STATES = ["past", "current", "upcoming"] as const;
export type ScheduleState = (typeof SCHEDULE_STATES)[number];

/** How many days POST /work-schedules/preview shows from the effective date. */
export const PREVIEW_DAYS = 7;
