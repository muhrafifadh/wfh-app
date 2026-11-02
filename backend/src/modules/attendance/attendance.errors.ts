import { AppError } from "@/common/errors/app-error.js";

// DOMAIN_RULES.md §16 — codes are stable once released in API v1.

export class EmployeeInactiveError extends AppError {
  readonly status = 422;
  readonly code = "EMPLOYEE_INACTIVE";

  constructor() {
    super("Your employee profile isn't active for today. Contact HR.");
  }
}

export class NotWorkdayError extends AppError {
  readonly status = 422;
  readonly code = "ATTENDANCE_NOT_WORKDAY";

  constructor(reason: string, holidayName: string | null) {
    super(holidayName ? `Today is a holiday (${holidayName}).` : "Today is not a working day.", {
      reason,
      holidayName,
    });
  }
}

export class CheckInTooEarlyError extends AppError {
  readonly status = 422;
  readonly code = "CHECK_IN_TOO_EARLY";

  constructor(opensAt: Date) {
    super("Check-in isn't open yet.", { opensAt: opensAt.toISOString() });
  }
}

export class CheckInWindowClosedError extends AppError {
  readonly status = 422;
  readonly code = "CHECK_IN_WINDOW_CLOSED";

  constructor(closedAt: Date) {
    super(
      "Today's check-in window has closed. You can request a correction after the day closes.",
      {
        closedAt: closedAt.toISOString(),
      },
    );
  }
}

export class AlreadyCheckedInError extends AppError {
  readonly status = 409;
  readonly code = "ATTENDANCE_ALREADY_CHECKED_IN";

  constructor() {
    super("You've already checked in today.");
  }
}

export class NotCheckedInError extends AppError {
  readonly status = 409;
  readonly code = "ATTENDANCE_NOT_CHECKED_IN";

  constructor() {
    super("You haven't checked in today.");
  }
}

export class AlreadyCheckedOutError extends AppError {
  readonly status = 409;
  readonly code = "ATTENDANCE_ALREADY_CHECKED_OUT";

  constructor() {
    super("You've already checked out today.");
  }
}

export class CheckOutWindowClosedError extends AppError {
  readonly status = 422;
  readonly code = "CHECK_OUT_WINDOW_CLOSED";

  constructor(closedAt: Date) {
    super("The check-out deadline has passed. Request a correction instead.", {
      closedAt: closedAt.toISOString(),
    });
  }
}

/** Close-day only processes dates that have ended in the organization's zone. */
export class CloseDayDateNotEndedError extends AppError {
  readonly status = 422;
  readonly code = "CLOSE_DAY_DATE_NOT_ENDED";

  constructor(earliestOpen: string) {
    super(`Only dates before ${earliestOpen} can be closed.`, {
      fieldErrors: { date: [`Use a date before ${earliestOpen}`] },
    });
  }
}

export class IdempotencyKeyRequiredError extends AppError {
  readonly status = 400;
  readonly code = "IDEMPOTENCY_KEY_REQUIRED";

  constructor() {
    super("Send an Idempotency-Key header (1–128 visible characters, e.g. a UUID).");
  }
}

/** The key was already used for a different request (another action or day). */
export class IdempotencyKeyReusedError extends AppError {
  readonly status = 409;
  readonly code = "IDEMPOTENCY_KEY_REUSED";

  constructor() {
    super("This Idempotency-Key was already used for a different request. Use a new key.");
  }
}

/** The organization requires a photo or location: use POST /attendance-verification/check-in or check-out. */
export class VerificationRequiredError extends AppError {
  readonly status = 409;
  readonly code = "VERIFICATION_REQUIRED";

  constructor() {
    super("Your organization needs a photo and location to record attendance.");
  }
}
