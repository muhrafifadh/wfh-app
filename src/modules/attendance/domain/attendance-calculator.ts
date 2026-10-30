// DOMAIN_RULES.md §7–9 — the one place attendance times turn into status, lateness,
// duration and completion. Check-in/out, close-day and corrections all use it, so they
// can never disagree. Pure functions: callers pass the instant (from Clock).

import type { ScheduleBoundaries } from "@/modules/work-settings/domain/schedule-policy.js";

const MINUTE_MS = 60_000;

export type CheckInStatus = { status: "present" | "late"; lateMinutes: number };

/**
 * §7.3 — on time up to and including the deadline; after it, late by the started
 * minutes: ceil((checkInAt - onTimeDeadline) / 1 minute).
 */
export const statusAtCheckIn = (checkInAt: Date, onTimeDeadlineAt: Date): CheckInStatus => {
  const lateMs = checkInAt.getTime() - onTimeDeadlineAt.getTime();
  return lateMs <= 0
    ? { status: "present", lateMinutes: 0 }
    : { status: "late", lateMinutes: Math.ceil(lateMs / MINUTE_MS) };
};

/** §8.2 / §13 — elapsed whole minutes, rounded down. */
export const workedMinutesBetween = (checkInAt: Date, checkOutAt: Date): number =>
  Math.floor((checkOutAt.getTime() - checkInAt.getTime()) / MINUTE_MS);

export type CheckInWindow = "too_early" | "open" | "closed";

/** §7.2 — the window is inclusive at both ends. */
export const checkInWindowAt = (
  now: Date,
  boundaries: Pick<ScheduleBoundaries, "checkInOpensAt" | "checkInClosesAt">,
): CheckInWindow =>
  now < boundaries.checkInOpensAt
    ? "too_early"
    : now > boundaries.checkInClosesAt
      ? "closed"
      : "open";

/** §8.1 — check-out is allowed up to and including the deadline. */
export const canCheckOutAt = (now: Date, checkOutClosesAt: Date): boolean =>
  now <= checkOutClosesAt;

/** §9.2 — an open record past its check-out deadline is incomplete. */
export const isIncomplete = (
  record: { completion: string; checkOutClosesAt: Date },
  now: Date,
): boolean => record.completion === "open" && now > record.checkOutClosesAt;

export type RecordedValues = CheckInStatus & {
  completion: "open" | "complete";
  workedMinutes: number | null;
};

/**
 * §11.1 — what a record becomes with these timestamps (corrections recalculate
 * everything; employees never propose a status).
 */
export const valuesFor = (
  checkInAt: Date,
  checkOutAt: Date | null,
  onTimeDeadlineAt: Date,
): RecordedValues => ({
  ...statusAtCheckIn(checkInAt, onTimeDeadlineAt),
  completion: checkOutAt ? "complete" : "open",
  workedMinutes: checkOutAt ? workedMinutesBetween(checkInAt, checkOutAt) : null,
});
