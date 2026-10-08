# CLAUDE.md

NestJS + TypeScript + PostgreSQL (Prisma) + JWT auth boilerplate. The client is [`frontend-boilerplate`](https://github.com/muhrafifadh/frontend-boilerplate) (Next.js).

The rules live in [`docs/`](docs/README.md). **Before you write or review code, read [`docs/quick-reference.md`](docs/quick-reference.md), then the topic docs for the task:**

| Task | Read |
|---|---|
| Adding a whole module | `docs/playbooks/new-module.md` |
| Adding or changing an endpoint | `docs/05-api-design.md`, `docs/06-validation-and-dtos.md`, `docs/09-authorization.md` |
| Business logic | `docs/03-modules-and-layers.md`, `docs/10-error-handling.md` |
| Queries, transactions | `docs/07-database-and-prisma.md` |
| Schema changes | `docs/playbooks/database-migration.md` |
| Login, tokens, sessions | `docs/08-authentication.md`, `docs/13-security.md` |
| Emails, async work, schedules | `docs/15-background-jobs.md` |
| Env vars | `docs/11-configuration.md` |
| Logging, health checks | `docs/12-logging-and-observability.md` |
| Tests | `docs/14-testing.md` |
| Commits / PRs | `docs/16-tooling-and-git.md`, `docs/playbooks/pr-checklist.md` |

## Never break these

- Controller → service → repository. Only repositories call Prisma (services may start `$transaction`).
- Every route has `@RequirePermissions(...)` or `@Public()`. Every record loaded by ID is checked against the caller's organization (404 if it doesn't match).
- Strict Zod DTOs for every input. A response DTO for every output. Never return raw Prisma rows.
- Services throw `AppError` subclasses with stable codes, never `HttpException`.
- Never edit a migration after it's merged. Never write SQL by concatenating strings. Never read `process.env` outside `src/config/`.
- The API contract (`docs/05-api-design.md`) is shared with the frontend. Call out any change to it.

## Before saying a task is done

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

If a rule seems wrong for the task, say so. Don't quietly break it. Rule changes go through the docs ([docs/README.md](docs/README.md#changing-a-rule)).
