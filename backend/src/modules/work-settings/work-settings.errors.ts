import { AppError } from "@/common/errors/app-error.js";

/** DOMAIN_RULES.md §6.2 — changes take effect no earlier than the next work date. */
export class ScheduleEffectiveDateTooEarlyError extends AppError {
  readonly status = 422;
  readonly code = "SCHEDULE_EFFECTIVE_DATE_TOO_EARLY";

  constructor(earliest: string) {
    super(`A schedule change can take effect on ${earliest} at the earliest.`, {
      earliest,
      fieldErrors: { effectiveFrom: [`Use ${earliest} or later`] },
    });
  }
}

/** A version already starts on or after this date: periods can't overlap. */
export class SchedulePeriodOverlapError extends AppError {
  readonly status = 409;
  readonly code = "SCHEDULE_PERIOD_OVERLAP";

  constructor(conflictingId?: string) {
    super("Another schedule version already starts on or after this date.", {
      ...(conflictingId && { conflictingScheduleId: conflictingId }),
      fieldErrors: { effectiveFrom: ["Overlaps another schedule version"] },
    });
  }
}
