import { AppError, ConflictError } from "@/common/errors/app-error.js";

/** The deployment doesn't allow these checks at all (VERIFICATION_ENABLED is off). */
export class VerificationNotAvailableError extends ConflictError {
  constructor() {
    super(
      "Attendance verification isn't available on this deployment.",
      "VERIFICATION_NOT_AVAILABLE",
    );
  }
}

export class VerificationDisabledError extends ConflictError {
  constructor() {
    super("This check isn't turned on for your organization.", "VERIFICATION_DISABLED");
  }
}

export class VerificationNoticeRequiredError extends ConflictError {
  constructor() {
    super("Read the attendance checks notice first.", "VERIFICATION_NOTICE_REQUIRED");
  }
}

/** Decision V7: turning a method on needs a documented reason. */
export class VerificationJustificationRequiredError extends AppError {
  readonly status = 422;
  readonly code = "VERIFICATION_JUSTIFICATION_REQUIRED";

  constructor() {
    super("Record why this check is needed before turning it on.", {
      fieldErrors: { justification: ["Record why this check is needed"] },
    });
  }
}

/** The photo or location that this check-in or check-out needs is missing. */
export class VerificationPhotoRequiredError extends ConflictError {
  constructor() {
    super("Take a photo to record your attendance.", "VERIFICATION_PHOTO_REQUIRED");
  }
}

export class VerificationLocationRequiredError extends ConflictError {
  constructor() {
    super("Share your location to record your attendance.", "VERIFICATION_LOCATION_REQUIRED");
  }
}

export class WorkLocationAlreadyDecidedError extends ConflictError {
  constructor() {
    super("This location request has already been decided.", "WORK_LOCATION_ALREADY_DECIDED");
  }
}

export class PhotoRequestAlreadyDecidedError extends ConflictError {
  constructor() {
    super("This photo request has already been decided.", "PHOTO_REQUEST_ALREADY_DECIDED");
  }
}

/** Photos are deleted after 30 days (decision V3). */
export class PhotoNotAvailableError extends ConflictError {
  constructor() {
    super("This photo is no longer available.", "PHOTO_NOT_AVAILABLE");
  }
}
