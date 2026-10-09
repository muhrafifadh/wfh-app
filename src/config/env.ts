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

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().default("backend-boilerplate"),
    JWT_AUDIENCE: z.string().default("frontend-boilerplate"),

    CORS_ORIGINS: csv,
    /** Where links in emails point (password reset). */
    FRONTEND_URL: z.url().default("http://localhost:3000"),

    /** Public sign-up (POST /auth/register). Off unless explicitly enabled. */
    REGISTRATION_ENABLED: flag.default(false),

    /**
     * console: prints emails, links included (development only).
     * memory: keeps them for tests. disabled: drops them (until SMTP is added).
     */
    MAIL_TRANSPORT: z.enum(["console", "memory", "disabled"]).default("console"),
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
  .refine((env) => env.NODE_ENV !== "production" || env.MAIL_TRANSPORT === "disabled", {
    // console and memory would print or keep reset links: never in production
    message: "MAIL_TRANSPORT must be 'disabled' in production until a real transport exists.",
    path: ["MAIL_TRANSPORT"],
  });

export type Env = z.infer<typeof envSchema>;
