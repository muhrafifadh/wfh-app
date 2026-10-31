// docs/10-error-handling.md — services throw these, never HttpException.
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = "NOT_FOUND";

  constructor(resource = "Resource") {
    super(`${resource} not found.`);
  }
}

export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code = "FORBIDDEN";

  constructor() {
    super("You don't have permission to do this.");
  }
}

export class UnauthenticatedError extends AppError {
  readonly status = 401;
  readonly code = "UNAUTHENTICATED";

  constructor(message = "You need to sign in.") {
    super(message);
  }
}

export class ConflictError extends AppError {
  readonly status = 409;
  readonly code: string;

  constructor(message: string, code = "CONFLICT", details?: Record<string, unknown>) {
    super(message, details);
    this.code = code;
  }
}
