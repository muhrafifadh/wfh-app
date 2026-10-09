import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// docs/17-environment-and-config.md — the only place that reads process.env.
export const env = createEnv({
  server: {
    API_URL: z.url(),
    SESSION_SECRET: z.string().min(32),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
  },
  runtimeEnv: {
    API_URL: process.env.API_URL,
    SESSION_SECRET: process.env.SESSION_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  // Lets Docker builds and lint-only CI jobs run without real values.
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
