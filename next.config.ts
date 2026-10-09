import type { NextConfig } from "next";

import { withSentryConfig } from "@sentry/nextjs/config";

// Validate env vars at build/dev start — fail fast instead of at runtime.
import { env } from "./src/lib/env";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // There is no home page: "/" (and every post-sign-in fallback to it) lands on the dashboard.
  redirects: async () => [{ source: "/", destination: "/dashboard", permanent: false }],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// docs/13-error-handling.md#error-tracking — source maps are uploaded only when
// SENTRY_AUTH_TOKEN is set (and then removed from the public build).
export default withSentryConfig(nextConfig, {
  org: env.SENTRY_ORG,
  project: env.SENTRY_PROJECT,
  authToken: env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !env.SENTRY_AUTH_TOKEN },
  silent: true,
  // Don't send build telemetry to Sentry
  telemetry: false,
});
