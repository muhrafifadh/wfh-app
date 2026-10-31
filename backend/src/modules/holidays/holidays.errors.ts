import { AppError } from "@/common/errors/app-error.js";

/** DOMAIN_RULES.md §16 — one active holiday per date. */
export class HolidayDateConflictError extends AppError {
  readonly status = 409;
  readonly code = "HOLIDAY_DATE_CONFLICT";

  constructor() {
    super("There's already a holiday on this date.", {
      fieldErrors: { date: ["Already a holiday"] },
    });
  }
}
