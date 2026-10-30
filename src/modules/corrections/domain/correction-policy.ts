// DOMAIN_RULES.md §11 — the submission deadline and what a proposal may contain.
// Pure functions: callers pass the instant (from Clock).

import { addDays, localDateOf, zonedToUtc, type LocalDate } from "@/common/time/zoned-time.js";

/** §11.2 — submissions are accepted until 23:59:59 on the seventh day after the work date. */
export const CORRECTION_WINDOW_DAYS = 7;

/** The first instant submissions are refused: midnight starting day 8, in the record's zone. */
export const submissionClosesAt = (workDate: LocalDate, timeZone: string): Date =>
  zonedToUtc(addDays(workDate, CORRECTION_WINDOW_DAYS + 1), 0, timeZone);

export const canSubmitAt = (now: Date, workDate: LocalDate, timeZone: string): boolean =>
  now < submissionClosesAt(workDate, timeZone);

export type TimePair = { checkInAt: Date | null; checkOutAt: Date | null };
export type Proposal = { checkInAt?: Date; checkOutAt?: Date };

/** The record's timestamps if the proposal is applied: proposed where given, else current. */
export const resultingPair = (current: TimePair, proposal: Proposal): TimePair => ({
  checkInAt: proposal.checkInAt ?? current.checkInAt,
  checkOutAt: proposal.checkOutAt ?? current.checkOutAt,
});

const sameInstant = (a: Date | null, b: Date | null) => a?.getTime() === b?.getTime();

/**
 * §11.4 — field errors for a proposal, empty if valid: the resulting pair has a
 * check-in, check-out is not before it, both fall on the work date and not after
 * `now`, and something actually changes.
 */
export const proposalErrors = (
  current: TimePair,
  proposal: Proposal,
  context: { workDate: LocalDate; timeZone: string; now: Date },
): Record<string, string[]> => {
  const errors: Record<string, string[]> = {};
  const add = (field: string, message: string) => (errors[field] ??= []).push(message);
  const { workDate, timeZone, now } = context;

  for (const [field, value] of [
    ["requestedCheckInAt", proposal.checkInAt],
    ["requestedCheckOutAt", proposal.checkOutAt],
  ] as const) {
    if (!value) continue;
    if (localDateOf(value, timeZone) !== workDate)
      add(field, `Must be on ${workDate} (${timeZone})`);
    if (value > now) add(field, "Can't be in the future");
  }

  const pair = resultingPair(current, proposal);
  if (!pair.checkInAt) add("requestedCheckInAt", "Required: the record has no check-in");
  else if (pair.checkOutAt && pair.checkOutAt < pair.checkInAt) {
    add("requestedCheckOutAt", "Must be at or after the check-in");
  }
  if (
    Object.keys(errors).length === 0 &&
    sameInstant(pair.checkInAt, current.checkInAt) &&
    sameInstant(pair.checkOutAt, current.checkOutAt)
  ) {
    add(
      proposal.checkInAt ? "requestedCheckInAt" : "requestedCheckOutAt",
      "Same as the current value",
    );
  }
  return errors;
};
