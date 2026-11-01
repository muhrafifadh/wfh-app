import { env } from "@/lib/env";

import type { BrowserOptions } from "@sentry/nextjs";

/**
 * docs/13-error-handling.md#error-tracking — the same options in the browser,
 * on the server and on the edge. Without NEXT_PUBLIC_SENTRY_DSN nothing is sent.
 */
export const sentryOptions = {
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(env.NEXT_PUBLIC_SENTRY_DSN),
  // Performance traces for 1 in 10 requests; errors are always sent
  tracesSampleRate: 0.1,
  // No IP addresses, cookies or request bodies. Add user ids explicitly if you need them.
  dataCollection: { userInfo: false, cookies: false, httpBodies: [] },
} satisfies BrowserOptions;
