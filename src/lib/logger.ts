import * as Sentry from "@sentry/nextjs";

// docs/13-error-handling.md — single place to report unexpected errors.
// Sends to Sentry when NEXT_PUBLIC_SENTRY_DSN is set; callers don't change.
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  console.error("[error]", error, context ?? {});
  Sentry.captureException(error, context && { extra: context });
}
