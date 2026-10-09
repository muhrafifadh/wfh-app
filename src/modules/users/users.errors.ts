import { AppError } from "@/common/errors/app-error.js";

/**
 * Registration has to say this (the user needs to know). The register rate
 * limit (3/hour per client) keeps it from being an email-enumeration oracle.
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
