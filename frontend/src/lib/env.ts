import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// docs/17-environment-and-config.md — the only place that reads process.env.
export const env = createEnv({
  server: {
    API_URL: z.url(),
    SESSION_SECRET: z.string().min(32),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // Shows the sign-up page. Keep in sync with the backend's REGISTRATION_ENABLED.
    REGISTRATION_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    // Lets the app ask for location and camera at check-in (ATTENDANCE_VERIFICATION_PLAN.md).
    // Keep in sync with the backend's VERIFICATION_ENABLED; off until legal and hosting are cleared.
    VERIFICATION_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    // Shows one-click test personas on the login page. Never set this where real people sign in.
    DEMO_LOGIN_PASSWORD: z.string().min(1).optional(),
    // Sentry source map upload at build time (docs/13-error-handling.md#error-tracking). All optional.
    SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
    SENTRY_ORG: z.string().min(1).optional(),
    SENTRY_PROJECT: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
    // Error tracking is off unless this is set
    NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
  },
  runtimeEnv: {
    API_URL: process.env.API_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    REGISTRATION_ENABLED: process.env.REGISTRATION_ENABLED,
    DEMO_LOGIN_PASSWORD: process.env.DEMO_LOGIN_PASSWORD,
    VERIFICATION_ENABLED: process.env.VERIFICATION_ENABLED,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
  // Lets Docker builds and lint-only CI jobs run without real values.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
