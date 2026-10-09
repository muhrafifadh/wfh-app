// docs/13-error-handling.md — single place to report unexpected errors.
// Wire an error tracker (e.g. Sentry) in here; callers don't change.
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  console.error("[error]", error, context ?? {});
}
