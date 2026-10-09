# 11 · Configuration

## Rules

- **All env vars are validated with Zod at startup** in `src/config/env.ts`. A missing or invalid variable stops the app before it starts listening.
- **Inject the typed `AppConfig` to read config.** Never read `process.env` outside `src/config/` (oxlint's `node/no-process-env` enforces this). The one exception is `prisma.config.ts`, which runs outside Nest.
- **`.env.example` lists every variable** with a placeholder value and a comment, and is committed. `.env` files are never committed.
- **When you add a variable, update `env.ts`, `.env.example`, the CI config, and the deployment's environment settings in the same PR.**
- **Secrets come from the environment** (or the platform's secret manager). They never appear in code, config files, or Docker images.
- **Values that aren't secret and don't change per environment are constants in code**, not env vars (`MAX_PAGE_SIZE`, token lifetimes).

## `env.ts`

```ts
// src/config/env.ts
import { z } from "zod";

import { parseTrustProxy } from "@/config/trust-proxy.js";

const csv = z.string().transform((s) =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
);

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(8000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().default("backend-boilerplate"),
  JWT_AUDIENCE: z.string().default("frontend-boilerplate"),

  CORS_ORIGINS: csv, // e.g. "http://localhost:3000,https://app.example.com"
  // Not z.coerce.boolean(): that turns the string "false" into true
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
});

export type Env = z.infer<typeof envSchema>;
```

## Typed access

```ts
// src/config/config.module.ts
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: (raw) => envSchema.parse(raw),
    }),
  ],
  providers: [AppConfig],
  exports: [AppConfig],
})
export class ConfigModule {}

@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction() {
    return this.get("NODE_ENV") === "production";
  }
}
```

## `.env.example`

```bash
NODE_ENV=development
PORT=8000
LOG_LEVEL=debug

# docker compose up -d
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/app?schema=public
REDIS_URL=redis://localhost:6379

# openssl rand -base64 48
JWT_ACCESS_SECRET=replace-me-with-at-least-32-random-characters

# Comma-separated list of allowed frontend origins
CORS_ORIGINS=http://localhost:3000
# Proxies allowed to set X-Forwarded-For. The frontend server must be listed.
TRUST_PROXY=loopback

# Links in emails point here
FRONTEND_URL=http://localhost:3000
# Public sign-up (POST /v1/auth/register)
REGISTRATION_ENABLED=true
# smtp (real delivery), console (dev: prints emails), memory (tests), disabled
MAIL_TRANSPORT=console
# For MAIL_TRANSPORT=smtp: smtp://user:pass@host:587 (STARTTLS) or smtps://…:465 (TLS)
# SMTP_URL=smtp://localhost:1025
# MAIL_FROM=Boilerplate <no-reply@localhost>
```

## Feature flags

- Feature flags are read through one `FlagsService`. Code asks the service whether a flag is on. Don't sprinkle `if (process.env.X)` checks through the code.
- Remove a flag and its old code path within one release after the feature is fully rolled out.

## Don't

- **Don't write `process.env.X!` or `process.env.X ?? "default"` in app code.**
- **Don't let code behave differently depending on `NODE_ENV`** except for logging, Swagger, and dev tooling.
- **Don't commit real secrets to `.env.example`**, even ones that "only work locally".

## Related

[13 Security](13-security.md) · [16 Tooling & Git](16-tooling-and-git.md)
