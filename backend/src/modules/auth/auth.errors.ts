import { AppError } from "@/common/errors/app-error.js";

export class InvalidCredentialsError extends AppError {
  readonly status = 401;
  readonly code = "INVALID_CREDENTIALS";

  constructor() {
    super("Email or password is incorrect.");
  }
}

/** The frontend refreshes and retries when it sees this code. */
export class AccessTokenExpiredError extends AppError {
  readonly status = 401;
  readonly code = "TOKEN_EXPIRED";

  constructor() {
    super("Your session has expired.");
  }
}

export class InvalidRefreshTokenError extends AppError {
  readonly status = 401;
  readonly code = "INVALID_REFRESH_TOKEN";

  constructor() {
    super("Your session has ended. Please sign in again.");
  }
}

export class RefreshTokenReusedError extends AppError {
  readonly status = 401;
  readonly code = "REFRESH_TOKEN_REUSED";

  constructor() {
    super("Your session has ended. Please sign in again.");
  }
}

export class InvalidResetTokenError extends AppError {
  readonly status = 400;
  readonly code = "INVALID_RESET_TOKEN";

  constructor() {
    super("This reset link is invalid or has expired. Request a new one.");
  }
}

/** Hidden as 404 so a disabled feature looks like a missing route. */
export class RegistrationDisabledError extends AppError {
  readonly status = 404;
  readonly code = "NOT_FOUND";

  constructor() {
    super("Not found.");
  }
}
