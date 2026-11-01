chore: scaffold NestJS app with core infrastructure

## What

Scaffolds the app described in `docs/` and sets up the infrastructure every module depends on. This PR is the scaffold only. Auth, CI and other features come in later PRs.

- **Stack:** NestJS 12 (ESM), Prisma 7.10 with `@prisma/adapter-pg`, and PostgreSQL 17 + Redis 7 via Docker Compose.
- **Config:** env vars validated by Zod in `src/config/env.ts`, read through a typed `AppConfig`. Tests use the committed `.env.test`.
- **Errors:** `AppError` with generic subclasses, and one global `AllExceptionsFilter` that turns every error into `{ error: { code, message, details?, requestId } }`.
- **Validation:** `nestjs-zod` validates requests (`APP_PIPE`) and serializes responses (`APP_INTERCEPTOR`).
- **Logging:** `nestjs-pino` with redaction of secrets. `nestjs-cls` shares one request ID between the logger, the `x-request-id` header and error bodies.
- **Health:** `/health/live` and `/health/ready` (database ping), outside `/v1`, public and not rate limited.
- **HTTP setup:** helmet, a CORS allowlist, 1 MB body limit, `trust proxy`, rate limiting (100 requests/min), and Swagger at `/docs` outside production.
- **`configureApp()`** is shared by `main.ts` and the e2e tests, so tests run with the production setup.
- **Tooling:** strict TypeScript, oxlint (type-aware) with the project rules, Prettier with import sorting, Husky, lint-staged and commitlint.

## Checks (all passing locally)

| Check | Result |
|---|---|
| `pnpm lint` (`oxlint --type-aware .`) | ✅ |
| `pnpm typecheck` | ✅ |
| `pnpm test` | ✅ 5 unit tests: error mapping |
| `pnpm test:e2e` (real Postgres) | ✅ 7 tests: health, `/v1` prefix, validation error shape, `AppError` mapping, 404 shape, request ID, security headers |
| `pnpm build` + `node dist/main.js` | ✅ health checks up, DB ready, 404 shape with request ID, `/docs` 200, CORS allows `localhost:3000` and rejects other origins |

## Deliberate lint-rule check

I linted a throwaway file containing a `../` import, `any`, `console.log`, `process.env`, a non-null assertion, `@ts-ignore`, and a floating promise. oxlint **flagged all 7**. The file was deleted and isn't in this PR.

The pre-commit hook also caught a real gap: the override for config files didn't cover `vitest.config.e2e.ts`. The pattern is fixed, and `pnpm lint` now covers the whole repo, not just `src/` and `test/`.

## Version-specific changes

**NestJS 12 changed its defaults.** I kept them and updated the docs to match:

- **ESM:** imports end in `.js`. `nest build` rewrites the `@/` alias to relative paths (verified by running `dist/`).
- **Vitest instead of Jest:** `docs/14-testing.md` is updated.
- **oxlint instead of ESLint:** it covers every project rule. Import order is handled by `@ianvs/prettier-plugin-sort-imports`.

Other changes:

- **`consistent-type-imports` is off.** `import type` on injected classes breaks Nest's dependency injection, and `docs/02` now explains why.
- **The Prisma CLI is pinned to `7.10.0` to match `@prisma/client`.** `latest` resolved to `8.0.0-rc`, which caused peer-dependency conflicts.
- **Fixed a bug in my own docs:** `z.coerce.boolean()` turns the string `"false"` into `true`, so `TRUST_PROXY` now parses `"true"`/`"false"` explicitly. `docs/11` is updated.
- **Enum values are lowercase** in both Prisma and the API (from the docs PR, kept consistent here).

## Configurable container ports

Compose ports come from `.env`: `POSTGRES_PORT` (5432), `POSTGRES_TEST_PORT` (5433), `REDIS_PORT` (6379). This lets the project run alongside others that already use the default ports. `docs/16` explains how.

## Secrets

- `.env` is gitignored and not committed.
- `.env.example` contains placeholder values only.
- **`.env.test` is committed on purpose.** It only contains throwaway values for the local `postgres-test` container and a dummy JWT secret, which `pnpm test:e2e` and CI need. It holds no real credentials.

## Follow-ups (not in this PR)

- **Auth:** users, organizations, roles and sessions in the schema; login, refresh with rotation and reuse detection, logout, `/me`; auth and permissions guards; a seed user.
- **CI:** GitHub Actions running lint, typecheck, unit tests, e2e against a Postgres service container, the migration drift check, build, and `pnpm audit`.
- **Dockerfile:** multi-stage, non-root, with `prisma migrate deploy` run as a separate release step.
- **Redis readiness:** Redis isn't wired into the app yet, so `/health/ready` only checks the database. Add the Redis ping when the queue or throttler storage lands.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
