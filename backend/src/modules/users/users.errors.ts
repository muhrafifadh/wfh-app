import { AppError } from "@/common/errors/app-error.js";

/**
 * Registration has to say this (the user needs to know). The register rate
 * limit (3/hour per client) keeps it from being an email-enumeration oracle.
 * Inviting needs user:manage, so it can say it too.
 */
export class EmailTakenError extends AppError {
  readonly status = 409;
  readonly code = "EMAIL_TAKEN";

  constructor() {
    super("An account with this email already exists.", {
      fieldErrors: { email: ["Already registered"] },
    });
  }
}

/** You can't change your own role or deactivate yourself (you could lock everyone out). */
export class CannotChangeOwnAccountError extends AppError {
  readonly status = 422;
  readonly code = "CANNOT_CHANGE_OWN_ACCOUNT";

  constructor(action: "deactivate" | "change the role of") {
    super(`You can't ${action} your own account. Ask another admin.`);
  }
}

export class InvalidInvitationTokenError extends AppError {
  readonly status = 400;
  readonly code = "INVALID_INVITATION_TOKEN";

  constructor() {
    super("This invitation link is invalid or has expired. Ask for a new invitation.");
  }
}

export class InvalidVerificationTokenError extends AppError {
  readonly status = 400;
  readonly code = "INVALID_VERIFICATION_TOKEN";

  constructor() {
    super("This verification link is invalid or has expired. Request a new one.");
  }
}

export class UserNotInvitedError extends AppError {
  readonly status = 409;
  readonly code = "USER_NOT_INVITED";

  constructor() {
    super("This user has already accepted their invitation or is deactivated.");
  }
}
