# backend-boilerplate

NestJS 12 (ESM) · TypeScript · PostgreSQL 17 · Prisma 7 · JWT auth with rotating refresh tokens.

The API behind [`frontend-boilerplate`](https://github.com/muhrafifadh/frontend-boilerplate) (Next.js).

## Quick start

Requires Node 24 (`nvm use`), pnpm (`corepack enable`), and Docker.

```bash
pnpm install
cp .env.example .env        # set SEED_ADMIN_PASSWORD; change ports if they clash
docker compose up -d        # Postgres and Redis (dev + test), S3-compatible storage
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The API runs on http://localhost:8000/v1. Swagger: http://localhost:8000/docs. Health: `/health/live`, `/health/ready`.

## Scripts

| Command                                | What it does                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm dev`                             | Watch mode                                                                             |
| `pnpm build` / `pnpm start:prod`       | Build / run `dist/`                                                                    |
| `pnpm lint`                            | oxlint, type-aware (rules map to `docs/`)                                              |
| `pnpm typecheck`                       | `tsc --noEmit`                                                                         |
| `pnpm test`                            | Unit tests (Vitest)                                                                    |
| `pnpm test:e2e`                        | Applies migrations, then e2e tests against `postgres-test`, `redis-test` and `storage` |
| `pnpm db:migrate` / `pnpm db:generate` | New migration / regenerate the Prisma client                                           |
| `pnpm db:seed`                         | Dev data: org "Acme", owner role, admin user                                           |

CI runs all of the above plus a migration drift check and a production dependency audit on every PR.

## How it's organized

- `src/modules/<module>`: controller → service → repository, per domain:
  - `auth`: login, rotating refresh tokens, password reset, accepting invitations, email verification
  - `users`: users and roles, invitations, deactivation
  - `audit`: the audit log, written from domain events
  - `uploads`: files straight to S3-compatible storage through signed URLs
- `src/common`: decorators, errors, the global exception filter, throttling, types, events.
- `src/infra`: Prisma, mail, BullMQ queues, storage, health checks.

Background jobs (emails, the daily uploads cleanup) run on BullMQ in the API process. Local storage has a console at http://localhost:9001.

- `src/configure-app.ts`: the HTTP setup shared by `main.ts` and the e2e tests.

## Docs

The rules live in [`docs/`](docs/README.md). Start with [`docs/quick-reference.md`](docs/quick-reference.md). The API contract shared with the frontend is [`docs/05-api-design.md`](docs/05-api-design.md). AI agents: see [`CLAUDE.md`](CLAUDE.md).
