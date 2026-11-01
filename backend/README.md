# Hadir.in API (`backend/`)

The API for Hadir.in, a work-from-home attendance system: employees check in and out at server time, managers and Admin/HR review corrections, and Admin/HR run the organization's employees, schedule, holidays and reports.

NestJS 12 (ESM) · TypeScript · PostgreSQL 17 · Prisma 7 · Redis + BullMQ · JWT auth with rotating refresh tokens. The web app is [`frontend/`](../frontend) (Next.js), in the same repository. Product documents (requirements, domain rules, UX flows) are at the repository root: `DOMAIN_RULES.md`, `ARCHITECTURE.md`, `UX_FLOWS.md`.

## Quick start

Requires Node 24 (`nvm use`), pnpm (`corepack enable`), and Docker.

```bash
cp .env.example .env        # first: install runs `prisma generate`, which reads DATABASE_URL
                            # set SEED_ADMIN_PASSWORD (12+ characters); change ports if they clash
pnpm install
docker compose up -d        # project "hadirin": Postgres and Redis (dev + test), S3-compatible storage
pnpm db:migrate             # applies every migration to the dev database
pnpm db:seed                # the demo organization (see "Demo data")
pnpm dev
```

The API runs on http://localhost:8000/v1. Swagger UI: http://localhost:8000/docs. Health: `/health/live`, `/health/ready`. Local storage has a console at http://localhost:9001.

Every variable is listed, with a comment, in [`.env.example`](.env.example); the rules are in [`docs/11-configuration.md`](docs/11-configuration.md). Keep `REGISTRATION_ENABLED=false`: Admin/HR invite accounts, there is no public sign-up.

## Demo data

`pnpm db:seed` is idempotent and creates organization **Acme** (time zone `Asia/Jakarta`, support contact `hr@example.com`):

| Account                                                 | Role     | Employee                                        |
| ------------------------------------------------------- | -------- | ----------------------------------------------- |
| `SEED_ADMIN_EMAIL`                                      | Owner    | none (every permission)                         |
| `indah.permata@example.com`                             | Admin/HR | HR-001, People                                  |
| `rina.wijaya@example.com`                               | Manager  | EMP-001, Engineering manager                    |
| `budi.santoso@example.com` … `yoga.saputra@example.com` | Employee | EMP-002 to EMP-010, Engineering, report to Rina |

Demo accounts sign in with `SEED_DEMO_PASSWORD`, or `SEED_ADMIN_PASSWORD` when that isn't set. Joko Susilo (EMP-099) is an inactive employee without an account.

The seed also adds three divisions (Engineering, People, Finance), the baseline schedule (Monday–Friday, 09:00–17:00 WIB, 15 minutes' tolerance, check-in 08:00–17:00, check-out until 23:59:59.999), two holidays (4 November 2026 "Company Day (demo)" and Christmas Day), attendance for the last five working days before today (on time, late, absent and two forgotten check-outs), and two corrections: one approved, one pending. Dewi Anggraini's forgotten check-out has no correction yet, for trying the correction flow.

## API

- Base path `/v1`; Bearer access tokens; errors are `{ error: { code, message, details, requestId } }` with stable codes ([`docs/05-api-design.md`](docs/05-api-design.md), DOMAIN_RULES.md §16).
- The OpenAPI document is committed as [`openapi.json`](openapi.json) (regenerate with `pnpm openapi`); the frontend generates its types from it. Swagger UI serves the same document.
- Check-in and check-out need an `Idempotency-Key` header; retries with the same key return the first result.

## Roles and permissions

Each route requires a permission; roles are sets of permissions (`src/common/types/auth.ts`). Team scope means the caller's active direct reports.

| Permission                  | What it allows                                              | Owner | Admin/HR | Manager | Employee |
| --------------------------- | ----------------------------------------------------------- | :---: | :------: | :-----: | :------: |
| `attendance:self`           | Own check-in/out, today, history                            |   ✓   |    ✓     |    ✓    |    ✓     |
| `correction:submit`         | Request corrections to own records                          |   ✓   |    ✓     |    ✓    |    ✓     |
| `attendance:read_team`      | Team day and history                                        |   ✓   |          |    ✓    |          |
| `correction:decide_team`    | Decide direct reports' corrections                          |   ✓   |          |    ✓    |          |
| `report:read_team`          | Team reports                                                |   ✓   |          |    ✓    |          |
| `attendance:read_all`       | Organization dashboard                                      |   ✓   |    ✓     |         |          |
| `correction:decide_all`     | Decide any correction (never your own)                      |   ✓   |    ✓     |         |          |
| `report:read_all`           | Organization reports and CSV export                         |   ✓   |    ✓     |         |          |
| `employee:manage`           | Employees and their accounts                                |   ✓   |    ✓     |         |          |
| `division:manage`           | Divisions                                                   |   ✓   |    ✓     |         |          |
| `policy:manage`             | Schedule versions, settings and reminders, close-day re-run |   ✓   |    ✓     |         |          |
| `holiday:manage`            | Holidays                                                    |   ✓   |    ✓     |         |          |
| `user:read` / `user:manage` | Users and invitations                                       |   ✓   |    ✓     |         |          |
| `audit:read`                | Audit log                                                   |   ✓   |    ✓     |         |          |

The `member` role has `user:read` only. Every record loaded by ID is checked against the caller's organization and scope (404 otherwise).

## Attendance rules in brief

The full, normative rules are DOMAIN_RULES.md; the code cites its sections.

- **Server time only.** The client sends no times; the work date is the date in the organization's zone (`Asia/Jakarta`).
- **Status at check-in:** on time up to and including start + tolerance (09:15:00 is Present); after it, Late by the started minutes (09:15:01 is 1 minute late).
- **Windows:** check-in from 08:00 until 17:00; check-out until 23:59:59.999 of the work date. An open record past that is incomplete ("Missing check-out").
- **Schedules are versioned** and take effect from tomorrow at the earliest; each record keeps a snapshot of the schedule it was judged by.
- **Close-day** runs at 00:05 Jakarta time and marks eligible employees without a record Absent (never on weekends or holidays). Admin/HR can re-run it for a past date.
- **Corrections:** up to the end of the seventh day after the work date; one pending request per record; the requester can never decide their own; the first decision wins; approval recalculates status, lateness and duration from the snapshot.
- **Notifications:** a new correction emails the direct manager (Admin/HR when there's none who can decide it); a decision emails the requester. Each is sent at most once and never to the requester about their own request. Reminders (default 09:00 check-in, 18:00 check-out, set by Admin/HR) go on working days to employees who still need to act, at most once each per day, checked every 5 minutes. Locally, emails print to the API log (`MAIL_TRANSPORT=console`).

## Scripts

| Command                                | What it does                                                                           |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm dev`                             | Watch mode                                                                             |
| `pnpm build` / `pnpm start:prod`       | Build / run `dist/`                                                                    |
| `pnpm lint`                            | oxlint, type-aware (rules map to `docs/`)                                              |
| `pnpm typecheck`                       | `tsc --noEmit`                                                                         |
| `pnpm test`                            | Unit tests (Vitest)                                                                    |
| `pnpm test:e2e`                        | Applies migrations, then e2e tests against `postgres-test`, `redis-test` and `storage` |
| `pnpm openapi`                         | Builds and writes `openapi.json`                                                       |
| `pnpm db:migrate` / `pnpm db:generate` | New migration / regenerate the Prisma client                                           |
| `pnpm db:seed`                         | The demo organization above                                                            |

Before calling a change done: `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`. The e2e suite covers the domain scenarios in DOMAIN_RULES.md §17 (tolerance boundary, one second late, double-click and idempotency, forgotten check-out, schedule change, concurrent decisions, holiday, self-approval, the UTC/Jakarta boundary) with a fixed clock. CI also runs a migration drift check and a production dependency audit.

## How it's organized

- `src/modules/<module>`: controller → service → repository, per domain:
  - `auth`, `users`, `audit`, `uploads`: from the boilerplate (login, invitations, the audit log, files)
  - `employees` (and `/me`), `divisions`, `work-settings` (organization settings and schedule versions), `holidays`
  - `attendance`: today, check-in/out with idempotency, own history, close-day
  - `corrections`: requests, preview, review and decisions
  - `reports`: team day and history, the organization dashboard, reports, trends and the CSV export
  - `notifications`: emails about corrections (submitted → the reviewer, decided → the requester) and check-in/check-out reminders, through job queues; the caller's notification list and email preferences (`/v1/notifications`); daily retention cleanup
- `src/common`: decorators, errors, the global exception filter, throttling, time helpers, events.
- `src/infra`: Prisma, mail, BullMQ queues (emails, close-day, cleanups), storage, the clock, health checks.
- `src/configure-app.ts`: the HTTP setup shared by `main.ts` and the e2e tests.

## Known limitations

- One organization-wide schedule; no shifts, per-division schedules or leave.
- Managers see active direct reports only, one level deep.
- Pickers load one page of 100 options (employees, divisions, users), enough for the pilot.
- The CSV export is organization-wide (Admin/HR); managers read team reports on screen.
- Notifications are in the app and by email; Slack or Teams delivery isn't built (Phase 6D, needs a decision).
- No SSO, location, photo or device checks (PRODUCT_REQUIREMENTS.md §13).
- Background jobs (emails, close-day, cleanups) run on BullMQ inside the API process, so Redis must be up for close-day to mark absences.

## Docs

The rules live in [`docs/`](docs/README.md). Start with [`docs/quick-reference.md`](docs/quick-reference.md). The API contract shared with the frontend is [`docs/05-api-design.md`](docs/05-api-design.md). AI agents: see [`CLAUDE.md`](CLAUDE.md).
