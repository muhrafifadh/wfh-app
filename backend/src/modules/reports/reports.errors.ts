import { AppError } from "@/common/errors/app-error.js";

/** A query that's well-formed but outside what the caller may read (e.g. a date range). */
export class QueryOutOfRangeError extends AppError {
  readonly status = 400;
  readonly code = "VALIDATION_FAILED";

  constructor(fieldErrors: Record<string, string[]>) {
    super("Some fields are invalid.", { fieldErrors });
  }
}
