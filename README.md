# backend-boilerplate

NestJS 12 (ESM) · TypeScript · PostgreSQL 17 · Prisma 7 · JWT auth with rotating refresh tokens.

The API behind [`frontend-boilerplate`](https://github.com/muhrafifadh/frontend-boilerplate) (Next.js).

## Quick start

Requires Node 24 (`nvm use`), pnpm (`corepack enable`), and Docker.

```bash
pnpm install
cp .env.example .env        # set SEED_ADMIN_PASSWORD; change ports if they clash
docker compose up -d        # Postgres (dev + test) and Redis
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The API runs on http://localhost:8000/v1. Swagger: http://localhost:8000/docs. Health: `/health/live`, `/health/ready`.

## Scripts

| Command                                | What it does                                               |
| -------------------------------------- | ---------------------------------------------------------- |
| `pnpm dev`                             | Watch mode                                                 |
| `pnpm build` / `pnpm start:prod`       | Build / run `dist/`                                        |
| `pnpm lint`                            | oxlint, type-aware (rules map to `docs/`)                  |
| `pnpm typecheck`                       | `tsc --noEmit`                                             |
| `pnpm test`                            | Unit tests (Vitest)                                        |
| `pnpm test:e2e`                        | Applies migrations, then e2e tests against `postgres-test` |
| `pnpm db:migrate` / `pnpm db:generate` | New migration / regenerate the Prisma client               |
| `pnpm db:seed`                         | Dev data: org "Acme", owner role, admin user               |

CI runs all of the above plus a migration drift check and a production dependency audit on every PR.

## How it's organized

- `src/modules/<module>`: controller → service → repository, per domain (`auth`, `users`).
- `src/common`: decorators, errors, the global exception filter, throttling, types.
- `src/infra`: Prisma, health checks.
- `src/configure-app.ts`: the HTTP setup shared by `main.ts` and the e2e tests.

## Docs

The rules live in [`docs/`](docs/README.md). Start with [`docs/quick-reference.md`](docs/quick-reference.md). The API contract shared with the frontend is [`docs/05-api-design.md`](docs/05-api-design.md). AI agents: see [`CLAUDE.md`](CLAUDE.md).
