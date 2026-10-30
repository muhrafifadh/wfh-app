import { isoWeekday, zonedToUtc, type LocalDate } from "@/common/time/zoned-time.js";

/**
 * DOMAIN_RULES.md §6.1 — the rules of one schedule version. Times are milliseconds
 * since local midnight in `timezone`.
 */
export type SchedulePolicy = {
  timezone: string;
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  workingDays: number[];
  startTime: number;
  endTime: number;
  toleranceMinutes: number;
  checkInOpensAt: number;
  checkInClosesAt: number;
  checkOutDeadline: number;
};

/** Every instant attendance needs for one work date (§7, §8). */
export type ScheduleBoundaries = {
  workDate: LocalDate;
  checkInOpensAt: Date;
  scheduledStartAt: Date;
  /** Start + tolerance: a check-in at or before this is on time. */
  onTimeDeadlineAt: Date;
  scheduledEndAt: Date;
  checkInClosesAt: Date;
  checkOutClosesAt: Date;
};

export const onTimeDeadlineOf = (policy: Pick<SchedulePolicy, "startTime" | "toleranceMinutes">) =>
  policy.startTime + policy.toleranceMinutes * 60_000;

/** The weekday is in the schedule (holidays are checked separately). */
export const isScheduledWeekday = (policy: Pick<SchedulePolicy, "workingDays">, date: LocalDate) =>
  policy.workingDays.includes(isoWeekday(date));

export const boundariesFor = (policy: SchedulePolicy, workDate: LocalDate): ScheduleBoundaries => {
  const at = (msOfDay: number) => zonedToUtc(workDate, msOfDay, policy.timezone);
  return {
    workDate,
    checkInOpensAt: at(policy.checkInOpensAt),
    scheduledStartAt: at(policy.startTime),
    onTimeDeadlineAt: at(onTimeDeadlineOf(policy)),
    scheduledEndAt: at(policy.endTime),
    checkInClosesAt: at(policy.checkInClosesAt),
    checkOutClosesAt: at(policy.checkOutDeadline),
  };
};

type TimeField =
  "startTime" | "endTime" | "checkInOpensAt" | "checkInClosesAt" | "checkOutDeadline";

/**
 * §6.1 ordering: opens ≤ start < end, opens < closes ≤ check-out deadline.
 * Returns the broken rules, keyed by the field to fix (empty when valid).
 */
export const timeOrderErrors = (
  policy: Pick<SchedulePolicy, TimeField>,
): Partial<Record<TimeField, string>> => {
  const errors: Partial<Record<TimeField, string>> = {};
  if (policy.checkInOpensAt > policy.startTime) {
    errors.checkInOpensAt = "Check-in must open at or before the start time";
  }
  if (policy.endTime <= policy.startTime) errors.endTime = "Must be after the start time";
  if (policy.checkInClosesAt <= policy.checkInOpensAt) {
    errors.checkInClosesAt = "Must be after check-in opens";
  }
  if (policy.checkOutDeadline < policy.checkInClosesAt) {
    errors.checkOutDeadline = "Must be at or after check-in closes";
  }
  return errors;
};
