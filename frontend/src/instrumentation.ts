import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry";

/** Runs once per server runtime (Node.js and edge) when Next starts. */
export function register(): void {
  Sentry.init(sentryOptions);
}

/** Errors thrown in Server Components, route handlers, Server Actions and proxy.ts. */
export const onRequestError = Sentry.captureRequestError;
