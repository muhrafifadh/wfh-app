import { z } from "zod";

import { parseTrustProxy } from "@/config/trust-proxy.js";

const csv = z.string().transform((s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
);

// docs/11-configuration.md — every env var, validated at startup.
const flag = z.enum(["true", "false"]).transform((v) => v === "true");

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().default(8000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    /** Redis key prefix for BullMQ, so tests (and other apps) never share queues with dev. */
    QUEUE_PREFIX: z
      .string()
      .regex(/^[a-z0-9-]+$/, "Use lowercase letters, digits and dashes")
      .default("bull"),

    /** Object storage (docs/17-file-uploads.md). Any S3-compatible service; RustFS locally. */
    S3_BUCKET: z.string().min(3),
    S3_REGION: z.string().default("us-east-1"),
    /** Leave unset for AWS. Local storage container: http://localhost:9000 */
    S3_ENDPOINT: z.url().optional(),
    /** Unset in production on AWS to use the instance/task role instead of keys. */
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    /** Local storage needs path-style URLs (http://host/bucket/key). */
    S3_FORCE_PATH_STYLE: flag.default(false),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().default("backend-boilerplate"),
    JWT_AUDIENCE: z.string().default("frontend-boilerplate"),

    CORS_ORIGINS: csv,
    /** Where links in emails point (password reset). */
    FRONTEND_URL: z.url().default("http://localhost:3000"),

    /** Public sign-up (POST /auth/register). Off unless explicitly enabled. */
    REGISTRATION_ENABLED: flag.default(false),

    /**
     * Lets organizations turn on location and selfie checks. Off unless explicitly enabled:
     * production stays off until the deferred requirements in ATTENDANCE_VERIFICATION_PLAN.md §4 are met.
     */
    VERIFICATION_ENABLED: flag.default(false),

    /**
     * smtp: real delivery through SMTP_URL. console: prints emails, links
     * included (development only). memory: keeps them for tests. disabled: drops them.
     */
    MAIL_TRANSPORT: z.enum(["smtp", "console", "memory", "disabled"]).default("console"),
    /** smtp://user:pass@host:587 (STARTTLS) or smtps://user:pass@host:465 (TLS). */
    SMTP_URL: z.url({ protocol: /^smtps?$/ }).optional(),
    /** Sender, e.g. "Boilerplate <no-reply@example.com>". */
    MAIL_FROM: z.string().min(3).optional(),
    // Who may set X-Forwarded-For (docs/13-security.md). Parsed for Express "trust proxy".
    TRUST_PROXY: z
      .string()
      .default("")
      .transform((raw, ctx) => {
        try {
          return parseTrustProxy(raw);
        } catch (error) {
          ctx.addIssue({ code: "custom", message: (error as Error).message });
          return z.NEVER;
        }
      }),
  })
  .refine(
    (env) =>
      env.NODE_ENV !== "production" ||
      env.MAIL_TRANSPORT === "smtp" ||
      env.MAIL_TRANSPORT === "disabled",
    {
      // console and memory would print or keep reset links: never in production
      message: "MAIL_TRANSPORT must be 'smtp' or 'disabled' in production.",
      path: ["MAIL_TRANSPORT"],
    },
  )
  .refine((env) => env.MAIL_TRANSPORT !== "smtp" || (env.SMTP_URL && env.MAIL_FROM), {
    message: "MAIL_TRANSPORT=smtp needs SMTP_URL and MAIL_FROM.",
    path: ["SMTP_URL"],
  })
  .refine((env) => !env.S3_ACCESS_KEY_ID === !env.S3_SECRET_ACCESS_KEY, {
    message: "Set both S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY, or neither.",
    path: ["S3_ACCESS_KEY_ID"],
  });

export type Env = z.infer<typeof envSchema>;
