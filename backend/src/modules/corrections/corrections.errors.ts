import { AppError } from "@/common/errors/app-error.js";

// DOMAIN_RULES.md §16 — codes are stable once released in API v1.

export class CorrectionWindowClosedError extends AppError {
  readonly status = 422;
  readonly code = "CORRECTION_WINDOW_CLOSED";

  constructor(closedAt: Date) {
    super("Corrections for this day closed 7 days after the work date.", {
      closedAt: closedAt.toISOString(),
    });
  }
}

/** The proposed times aren't a valid, changed pair on the work date (§11.4). */
export class CorrectionTimesInvalidError extends AppError {
  readonly status = 422;
  readonly code = "CORRECTION_TIMES_INVALID";

  constructor(fieldErrors: Record<string, string[]>) {
    super("Check the proposed times.", { fieldErrors });
  }
}

export class CorrectionAlreadyPendingError extends AppError {
  readonly status = 409;
  readonly code = "CORRECTION_ALREADY_PENDING";

  constructor() {
    super("This record already has a correction waiting for a decision.");
  }
}

/** The record changed after submission (e.g. a check-out), so the proposal is stale. */
export class CorrectionVersionConflictError extends AppError {
  readonly status = 409;
  readonly code = "CORRECTION_VERSION_CONFLICT";

  constructor() {
    super(
      "The attendance record changed after this request was submitted. Reject it so the employee can submit a new one.",
    );
  }
}

export class CorrectionAlreadyDecidedError extends AppError {
  readonly status = 409;
  readonly code = "CORRECTION_ALREADY_DECIDED";

  constructor() {
    super("This request has already been decided.");
  }
}

export class CorrectionSelfApprovalForbiddenError extends AppError {
  readonly status = 403;
  readonly code = "CORRECTION_SELF_APPROVAL_FORBIDDEN";

  constructor() {
    super("You can't decide your own correction request.");
  }
}
