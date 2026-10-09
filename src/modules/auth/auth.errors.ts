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
