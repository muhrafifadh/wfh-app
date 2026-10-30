# Phase 0 Assessment — Hadir.in

| Attribute | Value                                            |
| --------- | ------------------------------------------------ |
| Phase     | 0 — Boilerplate assessment                       |
| Status    | Phase 0 and 0.5 in review                        |
| Date      | 30 October 2026                                  |
| Inputs    | `PRODUCT_REQUIREMENTS.md` v0.3, both repositories at `main` |

This document holds the six Phase 0 deliverables from PRD §15. No application code, migrations, or dependencies were changed.

## 1. Test baseline

Both repositories were clean on `main` before and after the run. The backend test containers (`postgres-test` on 5433, `redis-test` on 6380, `storage` on 9000) were started with `docker compose up -d --wait postgres-test redis-test storage` and are still running.

| Repo     | Command               | Result                                                                                       |
| -------- | --------------------- | -------------------------------------------------------------------------------------------- |
| backend  | `pnpm format:check`   | Pass                                                                                         |
| backend  | `pnpm lint`           | Pass (exit 0)                                                                                |
| backend  | `pnpm typecheck`      | Pass (exit 0)                                                                                |
| backend  | `pnpm test`           | Pass — 5 files, 39 tests                                                                     |
| backend  | `pnpm test:e2e`       | Pass — 7 files, 77 tests (the logged `ECONNREFUSED` comes from the SMTP-failure test)        |
| backend  | `pnpm openapi`        | Pass; committed `openapi.json` unchanged (no drift)                                          |
| frontend | `pnpm format:check`   | Pass                                                                                         |
| frontend | `pnpm lint`           | Pass (exit 0)                                                                                |
| frontend | `pnpm typecheck`      | Pass (exit 0)                                                                                |
| frontend | `pnpm test`           | Pass — 11 files, 59 tests                                                                    |
| frontend | `pnpm api:types:check`| Pass (types match `openapi.json`)                                                            |
| frontend | `pnpm build`          | First run **failed**: Next.js stopped on a security advisory. Second run passed.             |
| both     | `pnpm audit --prod`   | Vulnerabilities found — see §6.1                                                             |

Tooling: Node 24.22.1, pnpm 11.22.0.

## 2. Backend assessment (`backend-boilerplate`)

### 2.1 Stack

NestJS, TypeScript (ESM, `@/` path alias), Prisma 7 with the `pg` adapter, PostgreSQL 17, Redis + BullMQ, `@nestjs/event-emitter`, Zod via `nestjs-zod`, argon2, JWT, S3-compatible storage (RustFS locally), Nodemailer, Pino logging, Vitest (unit + e2e), oxlint, Prettier, commitlint. Eleven commits on `main`.

### 2.2 Architecture and conventions (from `CLAUDE.md` and `docs/`)

- **Layers:** controller → service → repository. Only repositories call Prisma; services may start `$transaction` and pass `tx` to repositories.
- **Route access:** every route must have `@Public()`, `@Authenticated()`, or `@RequirePermissions(...)`. `RouteAuthAuditor` refuses to start the app otherwise.
- **Guards:** `ThrottlerGuard` → `JwtAuthGuard` (global; checks the session and loads permissions per request) → `PermissionsGuard`.
- **IDOR rule:** every record loaded by ID is checked against the caller's organization; a mismatch returns 404.
- **DTOs:** strict Zod input DTOs and a response DTO for every output (`ZodSerializerInterceptor`).
- **Errors:** services throw `AppError` subclasses with stable codes; `AllExceptionsFilter` renders `{ error: { code, message, details?, requestId } }`.
- **API shape:** base `/v1`, plural kebab-case resources, no wrapper on success, lists as `{ items, page, pageSize, total }` (`common/dto/pagination.ts`, max page size 100, `sort`/`-sort`). Actions use `POST /:id/<action>` (e.g. `/users/:id/deactivate`).
- **Permissions:** `resource:action` strings in `src/common/types/auth.ts`, stored on `Role.permissions String[]`; one role per user (`User.roleId`). Frontend mirrors the list.
- **Audit:** modules **do not** write audit rows. They emit an `AuditableEvent` with `emitAsync()`, and `AuditListener` records it (one `@OnEvent("<namespace>.*")` handler per module). Audit rows are append-only.
- **Jobs:** BullMQ processors in `modules/<m>/jobs/`; schedules via `queue.upsertJobScheduler()` with a cron pattern **and a `tz` option** (e.g. uploads cleanup). No `@nestjs/schedule`.
- **Migrations:** forward-only, never edited after merge; raw SQL only through tagged templates.
- **Config:** env validated in `src/config/env.ts`; no `process.env` elsewhere. `REGISTRATION_ENABLED` defaults to `false` in the schema but is `true` in `.env.example` and `.env.test`.
- **Done check:** `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`.

### 2.3 Existing modules and endpoints

| Module    | Contents                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `auth`    | register (flagged), login, refresh, logout, logout-all, password reset, invitation accept, email verification, `GET /auth/me`; sessions, rotating refresh tokens, reuse detection |
| `users`   | list/get/invite/update, resend invitation, deactivate/reactivate (revokes sessions), `GET /roles`; user e-mail jobs; `user.*` domain events |
| `audit`   | `GET /audit-logs` (`audit:read`), listener for `user.*`                                                |
| `uploads` | presigned upload flow, file signature checks, daily cleanup scheduler                                  |
| `infra`   | Prisma (with soft-delete helpers), Redis health, BullMQ, mail transports, storage, health checks       |

### 2.4 Database

Five migrations (`init_auth`, `add_password_reset_tokens`, `add_user_lifecycle_and_soft_delete`, `add_audit_logs`, `add_uploads`). Models: `Organization` (id, name, timestamps, `deletedAt`), `Role`, `User` (email unique globally, `disabledAt`, `deletedAt`), `Session`, `RefreshToken`, `PasswordResetToken`, `UserToken`, `AuditLog`, `Upload`. UUIDv7 keys, `timestamptz(3)`, `snake_case` mapping.

Seed (`prisma/seed.ts`): organization `Acme`, roles `owner` (all permissions) and `member` (`user:read`), one owner from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`; idempotent upserts; refuses production.

Local infrastructure (`docker-compose.yml`): `postgres` (DB `app`), `postgres-test` (DB `app_test`, tmpfs), `redis`, `redis-test`, `storage`, optional `mailpit`. No compose project name is set.

### 2.5 Reusable for Hadir.in

Auth and sessions as-is; invitations for onboarding employee accounts; roles/permissions model; audit event pattern; pagination/sort helpers; `AppError` codes; BullMQ scheduler with timezone (close-day job at `5 0 * * *`, `tz: "Asia/Jakarta"`); e2e helpers and test containers; soft-delete helpers; seed structure.

## 3. Frontend assessment (`frontend-boilerplate`)

### 3.1 Stack

Next.js 16.4.0 (App Router, `cacheComponents` on, `proxy.ts` instead of middleware), React 19, TypeScript, Tailwind v4 (`@theme inline`, OKLCH tokens), shadcn/ui, Zod 4, react-hook-form, nuqs (URL state), TanStack Query, Recharts (`components/ui/chart.tsx`), sonner, next-themes (light/dark/system), Sentry, openapi-typescript, Vitest + Testing Library.

### 3.2 Architecture and conventions

- Server Components by default; `"use client"` only on the smallest interactive part.
- Every Server Action: `requireUser()` → Zod validation → backend → revalidate → `ActionResult`.
- Backend calls only through `lib/api/client.ts` (typed from `src/lib/api/schema.d.ts`).
- Filters and pagination in the URL via nuqs.
- No `any`, no hard-coded colors, no `process.env` outside `lib/env.ts`, no `../` imports.
- Feature folders: `features/<f>/{queries,actions,schemas,contract,constants,search-params}.ts` + `components/`.
- Navigation: `config/nav.ts` (`mainNav` with optional `permission`, `visibleNav()`); routes in `config/routes.ts`; app name in `config/site.ts`.
- Done check: `pnpm lint && pnpm typecheck && pnpm test`.

### 3.3 Existing routes and features

| Area                | State                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| `(auth)`            | login, register (hidden when `REGISTRATION_ENABLED` is false), forgot/reset password, accept-invite, verify-email |
| `(app)` shell       | sidebar, breadcrumb, command menu, user menu, settings dialog, theme menu, error/loading/not-found |
| `/dashboard`        | Example page built on **invoice sample data** (stats + revenue chart)                   |
| `/invoices`         | Example feature on **sample data**, no backend                                          |
| `/files`            | Uploads UI on the real backend                                                          |
| `/users`, `/users/:id` | Real user management (invite, edit role, deactivate)                                 |
| `/audit-log`        | Real audit log list with filters                                                        |
| Shared components   | confirm dialog, empty state, list pagination, sort header, table skeleton, text field, full shadcn set incl. calendar, chart, select, sheet, sidebar |

### 3.4 Theming

`globals.css` defines shadcn tokens in OKLCH for `:root` and `.dark`. Current palette is neutral. In shadcn, `--accent` is the **hover/subtle background** token, and `--secondary` is a neutral secondary button background — neither is a brand color slot.

### 3.5 Reusable for Hadir.in

App shell and permission-filtered nav; auth flows; users and audit pages unchanged; tables, filters, pagination, skeletons, empty states, confirm dialogs; Recharts wrapper for trends; dashboard card layout; `ActionResult` and error mapping in `lib/api/errors.ts`.

## 4. Feature gap analysis

Legend: ✅ implemented · 🟡 partial / needs adaptation · ❌ missing.

### 4.1 Authentication and authorization

| Requirement                     | State | Notes                                                                                   |
| ------------------------------- | :---: | --------------------------------------------------------------------------------------- |
| Login / logout                  |  ✅   | Reuse as-is.                                                                            |
| Secure sessions                 |  ✅   | HttpOnly cookies, rotating refresh, reuse detection, revoke on deactivate.              |
| RBAC                            |  🟡   | Mechanism exists; Hadir.in permissions and `admin_hr`/`manager`/`employee` roles missing. |
| Protected endpoints             |  ✅   | Enforced at startup by `RouteAuthAuditor`.                                              |
| Role-aware navigation           |  🟡   | `visibleNav()` exists; Hadir.in menu items missing.                                     |
| No self-registration            |  🟡   | Flag exists; `.env.example` files ship with `true`.                                     |

### 4.2 Employees and divisions

| Requirement                     | State | Notes                                                       |
| ------------------------------- | :---: | ----------------------------------------------------------- |
| Employee CRUD, activate/deactivate | ❌ | No `Employee` model. User activate/deactivate exists (✅). |
| Divisions                       |  ❌   |                                                             |
| Manager assignment              |  ❌   |                                                             |
| Role assignment                 |  ✅   | `PATCH /users/:id` with `roleId`; UI in `/users`.           |
| Account onboarding              |  ✅   | Invitations; reuse for employee accounts.                   |
| Employee profile view           |  ❌   |                                                             |

### 4.3 Attendance, history, corrections, configuration

| Requirement                                   | State | Notes                                              |
| --------------------------------------------- | :---: | -------------------------------------------------- |
| Work settings, schedule versions, holidays    |  ❌   | `Organization` has no timezone.                    |
| Check-in/out, status, late, duration          |  ❌   |                                                    |
| Idempotency, duplicate prevention             |  ❌   |                                                    |
| Close-day / absence                           |  ❌   | Scheduler pattern exists (✅).                     |
| History, filters, summaries, monthly view     |  ❌   | Table/filter/pagination primitives exist (✅).     |
| Corrections and approval workflow             |  ❌   |                                                    |
| Audit history                                 |  🟡   | Module + UI exist; new `*.` event namespaces needed. |

### 4.4 Dashboards and reports

| Requirement                       | State | Notes                                                           |
| --------------------------------- | :---: | --------------------------------------------------------------- |
| Employee/Manager/Admin dashboards |  🟡   | Layout, cards, chart exist on sample data; real data missing.   |
| Reports, trends, CSV              |  ❌   | Chart component exists.                                         |

### 4.5 Product experience

| Requirement                       | State | Notes                                                                 |
| --------------------------------- | :---: | --------------------------------------------------------------------- |
| English UI                        |  ✅   | Boilerplate copy is English.                                          |
| Hadir.in name                     |  ❌   | `siteConfig.name` is "Boilerplate".                                   |
| Brand palette                     |  ❌   | Neutral tokens.                                                       |
| Responsive                        |  ✅   | Sidebar collapses; `use-mobile` hook.                                 |
| Dates/times in Asia/Jakarta       |  ❌   | `lib/format.ts` formatters are fixed to **UTC**.                      |
| `hadirin` DB / Docker project name|  ❌   | DB `app`, no compose project name.                                    |
| Pilot seed (Engineering, 10 employees) | ❌ |                                                                 |

### 4.6 Documentation and testing

| Requirement               | State | Notes                                                           |
| ------------------------- | :---: | --------------------------------------------------------------- |
| Repo docs (engineering)   |  ✅   | Extensive `docs/` in both repos; must be extended, not replaced.|
| Hadir.in README/setup/demo|  ❌   | READMEs describe the boilerplate.                               |
| Test infrastructure       |  ✅   | Unit + e2e with real Postgres/Redis.                            |
| Time/concurrency fixtures |  ❌   | No `Clock` abstraction yet.                                     |

## 5. Implementation plan and proposed changes

The order in `PLANS.md` §5 holds; the assessment found nothing already built that changes it. One preliminary step is proposed (§5.0).

### 5.0 Proposed Phase 0.5 — security patch upgrade (needs your approval)

- Frontend: `next` 16.4.0 → ≥ 16.4.1, `zod` → ≥ 4.6.6.
- Backend: `zod` → ≥ 4.6.6, and patched transitive `body-parser`, `multer`, `nodemailer`, `qs`, `fast-uri`, `deepmerge` where the parent ranges allow.
- Re-run the full baseline; one `chore(deps)` commit per repo.

### 5.1 Phase 1 — backend foundation

| Area                         | Change                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`       | `Organization` + `timezone`, `supportContact`, `retentionYears`; new `Division`, `Employee` (with `managerId`), enums. |
| `prisma/migrations/`         | One new migration (`add_divisions_and_employees`) + SQL for check constraints.               |
| `src/common/types/auth.ts`   | Add permissions from `DATA_MODEL.md` §4.2.                                                   |
| `src/modules/divisions/`     | controller, service, repository, errors, events, DTOs.                                       |
| `src/modules/employees/`     | same, plus `me` endpoint, manager cycle check, account link/invite via `UsersService`.       |
| `src/modules/audit/audit.listener.ts` | Add `division.*` and `employee.*` handlers.                                         |
| `prisma/seed.ts`             | Roles `admin_hr`/`manager`/`employee`; Engineering division; pilot employees; demo users with passwords from env. |
| `.env.example`               | `REGISTRATION_ENABLED=false`; demo password variables.                                       |
| `test/`                      | `divisions.e2e-spec.ts`, `employees.e2e-spec.ts` (CRUD, 403, cross-org 404, cycles).         |
| `openapi.json`               | Regenerated.                                                                                 |

Endpoints: `GET/POST /v1/divisions`, `GET/PATCH /v1/divisions/:id`, `POST /v1/divisions/:id/deactivate|reactivate`; `GET/POST /v1/employees`, `GET/PATCH /v1/employees/:id`, `POST /v1/employees/:id/deactivate|reactivate`, `POST /v1/employees/:id/account`; `GET /v1/me/employee`.

### 5.2 Later phases (summary)

- **2A:** `work-settings`, `holidays` modules; `WorkSchedule`, `Holiday`; `Clock` in `src/common/` (or `infra/`).
- **2B:** `attendance` module; `Attendance`, `IdempotencyRecord`; calculator.
- **2C:** `attendance/jobs/close-day.*` with `upsertJobScheduler(..., { pattern: "5 0 * * *", tz })`.
- **3 / 3B:** `corrections`, `reports` modules.
- **4A:** `globals.css` tokens, `config/site.ts`, `config/nav.ts`, `config/routes.ts`, `types/auth.ts`, `lib/format.ts` (Jakarta formatters), remove invoices from nav, `.env.example`.
- **4B–4D:** new `features/*` and `app/(app)/*` routes per `ARCHITECTURE.md` §7.

## 6. Compatibility and risk assessment

### 6.1 Security advisories (high priority)

| Repo     | Package     | Severity      | Issue (summary)                                      | Fixed in   |
| -------- | ----------- | ------------- | ---------------------------------------------------- | ---------- |
| frontend | `next`      | 2× critical   | Unauthenticated RCE (Image Optimization; `use cache`) | 16.4.1     |
| frontend | `next`      | high          | DoS via Server Actions                               | 16.4.1     |
| both     | `zod`       | high          | Memory exhaustion on oversized constrained collections | 4.6.6    |
| backend  | `body-parser` | high        | DoS via trailing bytes                               | 2.4.0      |
| backend  | `multer`    | high          | DoS via pending async file                           | 2.5.0      |
| backend  | `nodemailer`| 3× moderate   | Address parser issues                                | 10.1.4     |
| both     | `fast-uri`, `qs`, `deepmerge` | low–moderate | Transitive                            | see audit  |

The Next.js build prints this advisory and stops on the first run. The advisory text also asks the agent to run `next upgrade --agent=security …`; that was **not** run, pending your decision (§5.0).

### 6.2 Breaking-change and migration risks

| Risk                                                                 | Impact                                                       | Mitigation                                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Audit is post-action via events, not in the same DB transaction      | An audit row could be lost if the listener fails after commit | Follow the convention (emit after commit with `emitAsync`, so the response waits for the write). `ARCHITECTURE.md` §6.8 updated. Revisit outbox only if needed. |
| Renaming DB `app` → `hadirin` and setting a compose project name     | Existing local volumes/containers are orphaned; `.env` must change | Do it in one commit with README steps; keep `app_test` working; optional, can be skipped. |
| Changing the seed organization name from `Acme`                      | Existing local DBs get a second organization                 | Keep `Acme` lookup or update in place by name; document a DB reset for the demo.            |
| Adding permissions to `PERMISSIONS`                                  | Frontend `types/auth.ts` must change in lockstep             | Paired commits; `owner` role gets all permissions via seed `update`.                        |
| `REGISTRATION_ENABLED=false` in `.env.test`                          | Existing register e2e tests may expect `true`                | Leave `.env.test` as is; change only `.env.example`.                                        |
| Removing invoices/sample dashboard                                   | Existing invoice tests (3 files) would be deleted            | Separate commit; or keep the feature and only remove it from nav.                           |
| shadcn token semantics                                               | Mapping brand "Accent" to `--accent` would turn every hover red | Map Primary to `--primary`/`--ring`/`--sidebar-primary`; soft pink to `--accent` (hover/highlight); Secondary/Accent reds to new `--brand-*` and chart tokens. Define `.dark` variants. |
| Date formatters fixed to UTC                                         | Wrong times shown everywhere                                 | Add Jakarta formatters (fixed zone keeps hydration stable); keep UTC ones for audit detail. |
| `cacheComponents` and "today" data                                   | Stale today status across midnight                           | Fetch today's data uncached/dynamic; tests around the date change.                          |
| User email is globally unique                                        | Fine for a single organization                               | Documented limitation for multi-tenant.                                                     |
| Exclusion constraints (schedule overlap) need `btree_gist`           | Extension must exist in local and test DBs                   | Enable it in the migration (`CREATE EXTENSION IF NOT EXISTS btree_gist`) or use transactional checks. |

### 6.3 Doc corrections made from this assessment

- `ARCHITECTURE.md` §6.8: audit uses the event/listener convention, not in-transaction writes.
- `ARCHITECTURE.md` §7 branding: token mapping per §6.2.

### 6.4 Decisions (resolved 30 October 2026)

1. Phase 0.5 security upgrade — **approved, done** (§7).
2. Local database and compose project — **renamed to `hadirin`** (§7).
3. Invoices example — **deleted** (§7).
4. Workspace root — **initialized as the documentation Git repository** (§7).
5. New rule: commits and PRs never credit Claude/Anthropic as co-author — **enforced by commitlint** (§7).

## 7. Phase 0.5 evidence — security upgrade and project setup

### 7.1 Commits (local only, nothing pushed)

| Repo     | Branch                  | Commit    | Subject                                                              |
| -------- | ----------------------- | --------- | -------------------------------------------------------------------- |
| backend  | `chore/security-upgrade`| `6e86a34` | chore(deps): patch zod, nodemailer and transitive security advisories |
| backend  | `chore/security-upgrade`| `975bd2c` | chore(git): reject ai co-author trailers in commit messages          |
| backend  | `chore/hadirin-setup`   | `21a198f` | chore: rename local databases and compose project to hadirin         |
| frontend | `chore/security-upgrade`| `8d708eb` | chore(deps): patch next.js and zod security advisories               |
| frontend | `chore/security-upgrade`| `29e985f` | chore(git): reject ai co-author trailers in commit messages          |
| frontend | `chore/hadirin-setup`   | `9e0de05` | chore: remove the invoices example feature                           |

`chore/hadirin-setup` is stacked on `chore/security-upgrade` in each repo.

### 7.2 Dependency changes

- Frontend: `next` and `eslint-config-next` 16.4.0 → 16.4.3; `zod` → 4.6.7; override `fast-uri: ^3.1.9`.
- Backend: `zod` → 4.6.7; `nodemailer` → 10.2.1; overrides `body-parser >=2.4.0`, `multer >=2.5.0`, `qs >=6.16.1`, `fast-uri ^3.1.9`.
- `deepmerge` 4.3.1 (low, via `nestjs-zod`) has no patched release; ignored as `GHSA-gcqx-w48m-w2h4` in `pnpm-workspace.yaml` with a removal note, like the existing `deepmerge-ts` entry.
- `pnpm audit --prod`: frontend **no known vulnerabilities**; backend only the two documented ignores. Dev-only tooling (frontend) still reports advisories; out of scope.

### 7.3 Commit rule

`commitlint.config.mjs` in both repos adds rule `no-ai-co-author`, which fails on a `Co-Authored-By` trailer naming Claude or Anthropic. Verified: a Claude trailer exits 1; a human co-author exits 0. Documented in each repo's `CLAUDE.md` and tooling doc.

### 7.4 Project setup

- Invoices feature, routes, nav entry, and 3 test files (20 tests) deleted; dashboard is a placeholder. Engineering docs still use invoices as generic code examples, which is intended.
- Compose `name: hadirin`; databases `hadirin` / `hadirin_test` in compose, `.env.example`, `.env.test`, CI, and `docs/11-configuration.md`. The local untracked `.env` was updated to `/hadirin` (port 5442 kept). Test containers now run as `hadirin-*`. The old `backend-boilerplate_storage-data` volume is no longer used and was left in place.

### 7.5 Verification after the changes

| Repo     | Checks                                                                 | Result                                  |
| -------- | ---------------------------------------------------------------------- | --------------------------------------- |
| backend  | format:check, lint, typecheck, test, test:e2e, openapi                 | All pass — 39 unit, 77 e2e (on `hadirin_test`); no OpenAPI drift |
| frontend | format:check, lint, typecheck, test, api:types:check, build            | All pass — 39 tests (59 before, minus 20 invoice tests); build passes on the first run |
