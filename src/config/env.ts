import { z } from "zod";

const csv = z.string().transform((s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
);

const bool = z.enum(["true", "false"]).transform((v) => v === "true");

// docs/11-configuration.md — every env var, validated at startup.
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(8000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default("backend-boilerplate"),
  JWT_AUDIENCE: z.string().default("frontend-boilerplate"),

  CORS_ORIGINS: csv,
  TRUST_PROXY: bool.default(false),
});

export type Env = z.infer<typeof envSchema>;
