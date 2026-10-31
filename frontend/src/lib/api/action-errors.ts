import { fail, type ActionResult } from "@/lib/actions";
import { ApiError } from "@/lib/api/errors";

export const FIX_FIELDS = "Please fix the highlighted fields.";

/**
 * UX_FLOWS.md §17 — turns a backend error a user can act on into an ActionResult with
 * approved copy (never the raw message) and the field errors the backend attached.
 * Codes not in `messages` (and anything that isn't an ApiError) are rethrown for the
 * error boundary.
 */
export function expectedFailure(
  error: unknown,
  messages: Partial<Record<string, string>>,
): ActionResult<never> {
  if (error instanceof ApiError) {
    const message = messages[error.code];
    if (message) return fail(message, error.fieldErrors);
    if (error.status === 400 && error.fieldErrors) return fail(FIX_FIELDS, error.fieldErrors);
    if (error.code === "FORBIDDEN") return fail("You don't have permission to do that.");
  }
  throw error;
}
