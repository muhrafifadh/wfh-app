import type { NextConfig } from "next";

import { withSentryConfig } from "@sentry/nextjs/config";

// Validate env vars at build/dev start — fail fast instead of at runtime.
import { env } from "./src/lib/env";

/**
 * Baseline headers for every response. The app is never framed, and it never asks for
 * camera, microphone or location (UX_FLOWS.md §21), so the browser refuses them too. The
 * one exception is attendance verification, and only where the deployment switch is on:
 * then this app's own pages may ask for location and the camera at check-in.
 */
const devicePermissions = env.VERIFICATION_ENABLED
  ? "camera=(self), microphone=(), geolocation=(self)"
  : "camera=(), microphone=(), geolocation=()";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: devicePermissions },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // There is no home page: "/" (and every post-sign-in fallback to it) lands on the dashboard.
  redirects: async () => [{ source: "/", destination: "/dashboard", permanent: false }],
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
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
