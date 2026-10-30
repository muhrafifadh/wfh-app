# Hadir.in web app (frontend-boilerplate)

The web app for Hadir.in, a work-from-home attendance system: check in and out, see your history and request corrections; managers follow their team and decide corrections; Admin/HR run employees, divisions, the schedule, holidays, dashboards and reports.

Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · TanStack Query · nuqs. Talks to [`backend-boilerplate`](https://github.com/muhrafifadh/backend-boilerplate) (NestJS) for data and auth. Product documents (requirements, domain rules, UX flows) live in the separate docs repository next to this one: `UX_FLOWS.md`, `DOMAIN_RULES.md`.

## Quick start

Requires Node 24 (`nvm use`), pnpm (`corepack enable`), and the backend running on `http://localhost:8000` with its demo data (`pnpm db:seed` there).

```bash
pnpm install
cp .env.example .env.local   # set SESSION_SECRET; keep REGISTRATION_ENABLED=false
pnpm dev
```

Open http://localhost:3000 (`pnpm dev --port 3001` if 3000 is taken; then set `NEXT_PUBLIC_APP_URL` to match, and the backend's `FRONTEND_URL` so links in emails point here). Every variable is described in [`.env.example`](.env.example) and [`docs/17-environment-and-config.md`](docs/17-environment-and-config.md).

## Demo accounts

From the backend seed (organization Acme, times in WIB). Demo accounts use the backend's `SEED_DEMO_PASSWORD` (or `SEED_ADMIN_PASSWORD` when unset):

| Sign in as                       | To see                                                                  |
| -------------------------------- | ----------------------------------------------------------------------- |
| `dewi.anggraini@example.com`     | An employee: today's card, My history, a forgotten check-out to correct |
| `rina.wijaya@example.com`        | The Engineering manager: team dashboard, `/team`, the correction review |
| `indah.permata@example.com`      | Admin/HR: organization dashboard, reports and CSV, every admin page     |
| The backend's `SEED_ADMIN_EMAIL` | The owner (every permission, no employee profile)                       |

## What's where

| Route                                                           | Who                  | What                                                          |
| --------------------------------------------------------------- | -------------------- | ------------------------------------------------------------- |
| `/dashboard`                                                    | everyone             | Own attendance; team today (manager); organization (Admin/HR) |
| `/attendance`                                                   | employees            | Today's status and Check in / Check out                       |
| `/attendance/history`, `/attendance/:id`                        | employees            | Daily list, monthly calendar, a record and its corrections    |
| `/corrections`, `/corrections/new`, `/corrections/:id`          | employees, reviewers | Own requests, requesting one, the comparison and decision     |
| `/corrections/review`                                           | managers, Admin/HR   | The review queue                                              |
| `/team`, `/team/:employeeId`                                    | managers             | Direct reports on a day; one person's last 90 days            |
| `/reports`                                                      | managers, Admin/HR   | Filters, summary, daily trend, records, CSV (Admin/HR)        |
| `/employees`, `/divisions`, `/holidays`, `/settings/attendance` | Admin/HR             | Administration                                                |
| `/users`, `/audit-log`, `/profile`                              | as permitted         | From the boilerplate; My profile for everyone                 |

Navigation shows only what the user's permissions allow; the backend enforces every permission and scope.

## Behaviour worth knowing

- **Server time is official.** "Today" comes from the server (`/me/context`, `/attendance/today`); the on-screen clock is an estimate seeded from the server, and times are shown in the organization's zone whatever the device's zone.
- **No optimistic success for attendance.** Check-in/out show success only after the backend confirms. Each attempt has an `Idempotency-Key` reused for its retries; if a response is lost, the card re-checks today's state before offering anything new.
- **Filters live in the URL** (history, lists, team, reports), so views can be shared and reloaded.
- **Dashboards** refresh every minute while visible, show "Last updated", and every number with a list behind it links to that list.

## Scripts

| Command                     | What it does                                                            |
| --------------------------- | ----------------------------------------------------------------------- |
| `pnpm dev`                  | Dev server                                                              |
| `pnpm build` / `pnpm start` | Production build / serve it                                             |
| `pnpm lint`                 | ESLint (rules map to `docs/`)                                           |
| `pnpm typecheck`            | `next typegen` + `tsc --noEmit` (includes the API contract checks)      |
| `pnpm test`                 | Vitest: unit, component and axe accessibility tests                     |
| `pnpm format`               | Prettier                                                                |
| `pnpm api:types`            | Regenerates `src/lib/api/schema.d.ts` from the backend's `openapi.json` |

Before calling a change done: `pnpm lint && pnpm typecheck && pnpm test`. CI runs format, lint, typecheck, test, the API types check, build and a production dependency audit.

## How it's organized

- `src/app`: routes only. `(auth)` holds sign-in, invitations and password reset, `(app)` the signed-in area, `api/` the route handlers (today's status, the CSV export).
- `src/features/<feature>`: domain code (components, actions, schemas, queries): `attendance`, `corrections`, `reports`, `employees`, `divisions`, `holidays`, `work-settings`, `profile`, plus the boilerplate's `auth`, `users`, `audit`, `files`. Features don't import each other; pages combine them.
- `src/lib/api`: the only backend client (`apiFetch`), errors and the generated contract; `src/lib/attendance`, `src/lib/dates`, `src/lib/time-zone`: shared formats and calendar helpers.
- `src/lib/auth`: session cookies, `requireUser()`, token refresh (used by `src/proxy.ts`).

## Known limitations

- Pickers load one page of 100 options (employees, divisions, users).
- A screen-reader pass hasn't been done yet; automated axe checks and keyboard use have.
- The schedule preview shows weekdays only; holidays are listed on the Holidays page.
- A reviewer opening a request sees "My corrections" highlighted in the sidebar (the page serves requesters and reviewers alike).
- English only; Indonesian zones (WIB, WITA, WIT) are named locally, other zones by their offset.

## Docs

The rules live in [`docs/`](docs/README.md). Start with [`docs/quick-reference.md`](docs/quick-reference.md). AI agents: see [`CLAUDE.md`](CLAUDE.md).
