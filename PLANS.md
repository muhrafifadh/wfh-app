# Implementation Plan — Hadir.in

| Attribute     | Value                                                   |
| ------------- | ------------------------------------------------------- |
| Status        | Baseline plan; implementation not started               |
| Version       | 0.2                                                     |
| Date          | 30 October 2026                                         |
| Product owner | Developer                                               |
| Repositories  | `backend-boilerplate`, `frontend-boilerplate`           |

## 1. Purpose

This document turns the PRD into an implementation order that people and coding agents can execute and verify. Phases follow the codebase and feature dependencies, not a fixed daily schedule. Each phase produces observable behavior and stops at an approval gate before the next phase starts.

This is a plan, not proof that work is done. Status changes only on the basis of observed repository changes and verification results.

## 2. Sources of truth

Read these before planning or implementing a phase:

1. [`PRODUCT_REQUIREMENTS.md`](PRODUCT_REQUIREMENTS.md) — goals, scope, product policy, phases, and AI rules.
2. [`DOMAIN_RULES.md`](DOMAIN_RULES.md) — normative formulas, boundaries, invariants, and error codes.
3. [`ARCHITECTURE.md`](ARCHITECTURE.md) — components, modules, runtime flows, API resources, reliability.
4. [`DATA_MODEL.md`](DATA_MODEL.md) — entities, permissions, constraints, indexes, retention, migrations, seed.
5. [`UX_FLOWS.md`](UX_FLOWS.md) — routes, screen states, copy, branding, accessibility.
6. Engineering docs in `backend-boilerplate/docs/` and `frontend-boilerplate/docs/`, plus each repo's `CLAUDE.md`/`AGENTS.md`.
7. `backend-boilerplate/openapi.json` — the machine-readable API contract once endpoints exist.

The official take-home assignment brief overrides all of the above on conflict.

When sources conflict:

- Business rules/formulas: `DOMAIN_RULES.md` wins.
- Scope and priority: the PRD wins.
- Runtime contract between apps: the approved OpenAPI wins.
- Implementation conventions: the relevant repository's docs win.
- Never choose silently. Stop the phase, record the conflict, and fix the wrong source after a human decision.

## 3. Current state

### 3.1 Backend available

- NestJS, Prisma 7, PostgreSQL 17, Redis/BullMQ, storage, mail, health checks.
- Authentication, rotating refresh tokens, sessions, invitations, password reset, registration behind `REGISTRATION_ENABLED`.
- Users, roles (`Role.permissions String[]`, one role per user), audit log, uploads.
- Controller → service → repository layering.
- OpenAPI export (`pnpm openapi`) and e2e infrastructure against a separate test database.
- Permissions today: `user:read`, `user:manage`, `audit:read`. Seed creates organization `Acme` with `owner` and `member` roles.

### 3.2 Frontend available

- Next.js 16 App Router, authenticated app shell with sidebar and command menu, login/logout/token refresh, accept-invite, password reset, register page.
- Typed backend client generated from OpenAPI (`pnpm api:types`).
- User management, audit log, files, example dashboard and invoices pages, shared table/form primitives.
- Server Components, Server Actions, URL-based filters, TanStack Query, Recharts, Vitest.

### 3.3 Missing

- Division, employee, work settings/schedule, holiday, attendance, correction, dashboard, and report domains.
- Attendance permissions and the `admin_hr`/`manager`/`employee` roles.
- Hadir.in branding and navigation.
- Timezone and concurrency test fixtures.

Both app repositories started on `main` and clean. Phase 0.5 work is on local branches `chore/security-upgrade` and `chore/hadirin-setup`. The workspace root is a separate documentation Git repository.

## 4. Plan rules

### 4.1 Status values

`Not started` · `Ready` · `In progress` · `Blocked` · `In review` · `Complete`

`Complete` is used only when all acceptance criteria are met and verification evidence is recorded.

### 4.2 Execution protocol per phase

1. **Preflight:** read the applicable docs, inspect the repository, Git status, and existing user changes.
2. **Plan delta:** list files/modules to change, migrations, API contract changes, risks, and non-goals.
3. **RED:** add the smallest test/check proving the behavior is missing or the bug is reproducible.
4. **GREEN:** implement the minimum that satisfies the phase scope.
5. **REFACTOR:** tidy only within the phase and keep tests green.
6. **VERIFY:** run focused tests, then the relevant repository-wide checks.
7. **COMMIT:** create clean, reviewable local commits in the affected repository (Conventional Commits, as enforced by commitlint).
8. **EVIDENCE:** record changed files, migrations, endpoints, commands run, results, limitations, and follow-ups.
9. **STOP:** ask for review/approval; do not start the next phase automatically.

### 4.3 Change boundaries

- Never edit an applied migration.
- Local commits are allowed, on a branch per phase, never directly on `main`. Push, merge, pull requests, deployment, production access, or use of real credentials require explicit approval.
- Commit messages and PRs never credit Claude/Anthropic or another AI tool as co-author (enforced by commitlint `no-ai-co-author`).
- Backend contract first; regenerate OpenAPI; then regenerate frontend types.
- Paired backend/frontend changes have a clear integration order and stay backward-compatible.
- Do not rebuild, replace, or duplicate boilerplate features (auth, users, roles, audit, UI kit). Extend them.
- Do not build future-scope features (PRD §13).
- Preserve unrelated user changes.

### 4.4 Definition of done per phase

- Scope and non-goals are respected.
- Acceptance criteria are demonstrable with evidence.
- Security and tenant isolation are tested negatively.
- OpenAPI and frontend generated types are in sync when the contract changes.
- Migrations apply from the previous state and from an empty database.
- No relevant lint/type/test/build regressions.
- Source-of-truth docs are updated when a decision changes.
- No known critical/high defects in phase scope.

## 5. Master roadmap

| Phase | Deliverable                                                     | Status      | Depends on     |
| ----: | --------------------------------------------------------------- | ----------- | -------------- |
|     0 | Boilerplate assessment, test baseline, gap analysis             | In review   | —              |
|   0.5 | Security upgrade and project setup                              | In review   | 0              |
|     1 | Backend foundation: roles/permissions, divisions, employees     | In review   | 0              |
|    2A | Backend work settings, schedule versions, holidays              | In review   | 1              |
|    2B | Backend attendance core (check-in/out, history, summaries)      | In review   | 2A             |
|    2C | Backend close-day job and absence                               | In review   | 2B             |
|     3 | Backend corrections and approvals                               | In review   | 2B             |
|    3B | Backend dashboards and reports                                  | In review   | 2C, 3          |
|    4A | Frontend shell, branding, auth adjustments, profile             | In review   | 1              |
|    4B | Frontend employees, divisions, settings, holidays               | In review   | 4A, 2A         |
|    4C | Frontend attendance, history, employee dashboard                | In review   | 4A, 2B         |
|    4D | Frontend corrections, team, manager/HR dashboards, reports      | In review   | 4C, 3, 3B      |
|     5 | Verification, demo seed, documentation, pilot walkthrough       | Not started | All            |

Phase numbers match PRD §15. Frontend sub-phases may start as soon as the backend contract they depend on is in `openapi.json`; they do not need to wait for all backend phases.

## 6. Phase details

### Phase 0 — Boilerplate assessment

**Status:** In review — deliverables and evidence in [`PHASE_0_ASSESSMENT.md`](PHASE_0_ASSESSMENT.md). All baseline checks pass in both repos; the first frontend build stopped on a Next.js security advisory, and `pnpm audit --prod` reports critical/high advisories (proposed Phase 0.5).

**Objective:** confirm what exists before any application code changes.

**In scope:**

- Inspect both repositories: stack, architecture, modules, auth, permissions, schema, migrations, layouts, routing, components, theme tokens, API client, state management.
- Run existing checks in both repositories to establish a baseline and record results.
- Produce the six Phase 0 deliverables from PRD §15: backend assessment, frontend assessment, gap analysis, implementation plan, proposed changes, compatibility and risk assessment.
- Decide whether to initialize the workspace root as a documentation Git repository.

**Out of scope:** application code, migrations, refactoring.

**Acceptance criteria:**

- Baseline test results for both repos are recorded (including pre-existing failures).
- Gap analysis lists each PRD requirement as implemented, partial, or missing.
- Any change to this plan from the assessment is reflected here.

**Baseline commands:**

```bash
cd backend-boilerplate
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

```bash
cd frontend-boilerplate
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm api:types:check && pnpm build
```

**Approval gate:** Developer (Product Owner + Engineering Reviewer) approves the assessment and starts Phase 1.

---

### Phase 0.5 — Security upgrade and project setup

**Status:** In review — evidence in [`PHASE_0_ASSESSMENT.md`](PHASE_0_ASSESSMENT.md) §7.

**Scope:** patch production security advisories in both repos; enforce the no-AI-co-author commit rule; remove the invoices example; rename the local databases and compose project to `hadirin`; make the workspace root a documentation Git repository.

**Branches:** `chore/security-upgrade` (security + commit rule) and `chore/hadirin-setup` (stacked on it) in each app repo.

---

### Phase 1 — Backend foundation and employee management

**Status:** In review — branch `feat/phase-1-master-data` in `backend-boilerplate` (stacked on `chore/hadirin-setup`); evidence below.

**Objective:** roles, permissions, and employee/division master data as the foundation for every transaction.

**In scope:**

- Add permissions from `DATA_MODEL.md` §4.2 to `src/common/types/auth.ts`.
- Seed roles `admin_hr`, `manager`, `employee`; keep `owner` and `member`.
- Organization fields: `timezone`, `supportContact`, `retentionYears`.
- `Division` and `Employee` models/migration (including `managerId`), constraints, indexes.
- `divisions` and `employees` modules following the repository layering.
- CRUD/list endpoints for Admin/HR; activate/deactivate; manager assignment with cycle check; link/invite user account and set role (reusing the existing invitation flow).
- `GET /v1/me/employee`.
- Audit events for important changes.
- Seed: Engineering division, pilot employees and manager, Admin/HR, negative fixtures (`DATA_MODEL.md` §16, master-data part).
- Generate OpenAPI.

**Out of scope:** schedules, attendance, bulk import.

**Expected areas:** `prisma/schema.prisma` + new migration, `src/common/types/auth.ts`, `src/modules/divisions/`, `src/modules/employees/`, `prisma/seed.ts`, `openapi.json`.

**Acceptance criteria:**

- Employee numbers match the pattern, are uppercased, and unique per organization.
- Divisions, employees, and managers from another organization cannot be read or linked.
- An employee without a user can be created; one user cannot link to two employees.
- Manager self-assignment and cycles are rejected.
- Deactivation keeps history and removes eligibility.
- Missing permission → 403; cross-tenant object → 404.
- Migration and seed are idempotent per repository conventions.
- Existing user/auth e2e tests still pass.

**Verification:**

```bash
cd backend-boilerplate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm openapi
```

**Approval gate:** review migration, permission list, OpenAPI, and negative access tests.

**Evidence (2026-10-30):**

| Commit    | Change                                                                                       |
| --------- | -------------------------------------------------------------------------------------------- |
| `9eaa771` | Permissions and `DEFAULT_ROLES`; registration creates every default role.                    |
| `ae049d4` | Migration `add_master_data`: organization settings, divisions, employees, checks, role data. |
| `6761657` | `divisions` and `employees` modules, `GET /v1/me/employee`, audit events, tests, OpenAPI.    |
| `a065d94` | Pilot seed (divisions, EMP-001…EMP-010, HR-001, inactive EMP-099).                           |

- Verification: format, lint, typecheck pass; 55 unit tests and 103 e2e tests pass (77 e2e before); `prisma migrate diff` shows no drift; `openapi.json` regenerated (10 new paths).
- The migration's role data step was run twice against an organization with only the legacy `owner` role: it gained `admin_hr`, `manager`, `employee`, the owner went from 3 to 15 permissions, and the second run changed nothing. The seed was also run twice with the same result.
- Decisions made during implementation:
  - Division and employee uniqueness covers soft-deleted rows too (Prisma can't express partial unique indexes without schema drift). Nothing deletes them in Phase 1: they are deactivated.
  - Division names are unique ignoring case, checked by the service; the database enforces exact-match uniqueness.
  - The employee number can't be changed after creation, so it is never reused.
  - Manager changes take a per-organization advisory lock before the recursive cycle check, so two concurrent changes can't form a cycle.
  - `POST /v1/employees/:id/account` takes `{ mode: "invite", email, roleId }` or `{ mode: "link", userId, roleId? }` and also needs `user:manage`. Role changes are audited as `user.updated` by the users module.
  - `GET /v1/me/employee` returns `EMPLOYEE_PROFILE_REQUIRED` (422) when the user has no profile.
  - Deactivating an employee doesn't disable their user account; deactivating a division only blocks new assignments.
- Follow-up for Phase 4A: the frontend's hand-copied `PERMISSIONS` list and generated API types must be refreshed (`pnpm api:types`).

---

### Phase 2A — Backend work settings, schedules, and holidays

**Status:** In review — branch `feat/phase-2a-work-settings` in `backend-boilerplate` (stacked on `feat/phase-1-master-data`); evidence below.

**Objective:** the backend determines the effective schedule, working days, and every attendance boundary deterministically.

**In scope:**

- `WorkSchedule` and `Holiday` models/migration.
- `work-settings` and `holidays` modules; organization-scope schedule resolver; `isWorkingDay`.
- `Clock` abstraction with a fixed clock for tests.
- Endpoints for settings, schedule versions (with computed boundary preview), and holidays.
- Validation: overlap, ordering of window/start/end/deadline, weekdays, tolerance, IANA timezone, effective date ≥ tomorrow.
- Audit events; seed baseline schedule and a pilot-period holiday.

**Out of scope:** division/employee schedules, shifts.

**Acceptance criteria:**

- Baseline yields 08:00 open, 09:15 on-time deadline, 17:00 check-in close, 23:59:59.999 check-out close in `Asia/Jakarta`.
- Changes cannot take effect today or retroactively.
- Overlapping periods are rejected, including under parallel requests.
- Historical schedule versions are unchanged when a new version is created.
- Weekends and active holidays are non-working days.
- Boundary tests never depend on the real host clock.

**Verification:** fixed-clock unit tests, timezone integration tests, overlap concurrency test, migration/e2e/OpenAPI checks.

**Evidence (2026-10-30):**

| Commit    | Change                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------- |
| `1ad44a1` | `Clock` (`SystemClock`, `FixedClock`) and Intl-based time zone helpers (DST gaps and overlaps). |
| `3282d25` | Migration `add_schedules_and_holidays` with check constraints.                                  |
| `cff810e` | `work-settings` and `holidays` modules, `GET /v1/work-calendar`, audit events, tests, OpenAPI.  |
| `2e205c3` | Seed: baseline schedule from 2026-01-05, holidays 2026-11-04 (demo) and 2026-12-25.             |

- Verification: format, lint, typecheck pass; 71 unit tests and 125 e2e tests pass; `prisma migrate diff` shows no drift; `openapi.json` regenerated (7 new paths). The test app runs on a `FixedClock` (Monday 2 November 2026, 10:00 WIB), so no test reads the host clock.
- Acceptance: the baseline gives 08:00 / 09:15 / 17:00 / 23:59:59.999 WIB (unit and e2e preview); today and past dates are rejected; overlapping versions are rejected, including two parallel requests (one 201, one 409); the closed version's policy fields are unchanged; weekends and active holidays are non-working.
- Decisions made during implementation:
  - The time zone belongs to the schedule version. The work date is the local date in the zone of the version in force on it; `Organization.timezone` is only the default before any schedule exists. `PATCH /v1/work-settings` can't change the zone: that takes a new version (DOMAIN_RULES §5.3).
  - A new version is always open-ended. It closes the current open version the day before it starts; a version already starting on or after its date is a `SCHEDULE_PERIOD_OVERLAP`. Planned versions can't be deleted yet.
  - Overlap and the one-holiday-per-date rule are checked under per-organization advisory locks (Prisma can't describe exclusion constraints or partial unique indexes without schema drift). `(organizationId, scope, effectiveFrom)` is unique as a backstop.
  - `divisionId`/`employeeId` targets aren't added yet; a check constraint keeps `scope = 'organization'`.
  - `POST /v1/work-schedules/preview` validates a version and returns its UTC boundaries for 7 days without saving. `GET /v1/work-calendar?from&to` (≤ 62 days, `holiday:manage`) shows working days and why a day isn't one.
  - Holidays on past dates are allowed and audited with `past: true`.
  - The pilot week is assumed to be 2–6 November 2026; adjust the demo holiday in Phase 2B if the history days change.

---

### Phase 2B — Backend attendance core

**Status:** In review — branch `feat/phase-2b-attendance` in `backend-boilerplate` (stacked on `feat/phase-2a-work-settings`); evidence below.

**Objective:** authoritative, idempotent, concurrency-safe, tenant-safe check-in/out, history, and summaries.

**In scope:**

- `Attendance` and `IdempotencyRecord` models/migration.
- Shared calculator for work date, status, late minutes, completion, worked minutes.
- Endpoints: today, check-in, check-out, own history (date range, status, pagination), own summary (range/month), record detail.
- `Idempotency-Key` behavior with a durable result; unique constraint; compare-and-set check-out.
- Stable domain error codes; audit events; OpenAPI.

**Out of scope:** close-day, corrections, team/org views.

**Mandatory RED tests:**

- 09:15:00 = present; 09:15:01 = late by one minute.
- 07:59:59 rejected; 08:00:00 accepted; 17:00:00 accepted; 17:00:01 rejected.
- Weekend and holiday rejected.
- Check-out after 23:59:59.999 rejected.
- Device-supplied time is not accepted.
- Parallel check-in creates one row; parallel check-out keeps the first timestamp.
- Same idempotency key replays the result; changed context is rejected.
- User without an active employee profile is rejected.
- Cross-tenant reads return 404.
- A schedule change does not alter an old snapshot.
- UTC/Jakarta date boundary (`DOMAIN_RULES.md` Scenario J).

**Acceptance criteria:**

- `DOMAIN_RULES.md` §3–9 and §12 are enforced.
- No client-controlled timestamp, employee ID, organization ID, or status is accepted for own transactions.
- Ambiguous frontend responses can safely replay or read current state.
- OpenAPI fully describes success and stable errors.

**Verification:** calculator/service unit tests, real-Postgres e2e, concurrency test, tenant/permission negative tests, OpenAPI diff.

**Approval gate:** Engineering review signs off transaction isolation, idempotency, time boundaries, and schema constraints.

**Evidence (2026-10-30):**

| Commit    | Change                                                                                     |
| --------- | ------------------------------------------------------------------------------------------ |
| `fd6d59e` | Migration `add_attendance`: attendance with snapshot and check constraints; idempotency records. |
| `a7be01a` | Shared calculator (status, late minutes, window, deadline, worked minutes, incomplete).   |
| `00240c2` | Check-in/out, today, own history/summary/detail, idempotency, audit events, tests, OpenAPI. |

- Verification: format, lint, typecheck pass; 86 unit tests and 157 e2e tests pass (attendance suite repeated 3× without failures); `prisma migrate diff` shows no drift; `openapi.json` regenerated (6 new paths, `Idempotency-Key` header documented).
- Every mandatory RED test has an e2e case on real Postgres with a frozen clock: 09:15:00/09:15:01, 07:59:59/08:00:00/17:00:00/17:00:01, weekend and holiday, check-out at 23:59:59.999 accepted and at 00:00 rejected, client-supplied fields rejected, parallel check-in (3 → one row) and check-out (first kept, `version` 2), same-key replay (sequential and parallel), changed context, no/inactive profile, cross-tenant and colleague 404, schedule change after check-in, Scenario J.
- Decisions made during implementation:
  - Transaction isolation is PostgreSQL's default READ COMMITTED. Correctness comes from the unique `(organizationId, employeeId, workDate)` index, the compare-and-set check-out (`checkOutAt IS NULL AND version = n`), and the idempotency claim (`INSERT … ON CONFLICT DO NOTHING`), which makes a same-key request wait for the first one's commit.
  - The key is claimed in the same transaction as the attendance write. Only successful results are stored; a failed attempt rolls back and frees the key, so a retry is evaluated again (e.g. `CHECK_IN_TOO_EARLY` at 07:59, then success at 08:00). The key is stored as a SHA-256 hash, lives 24 hours, and its request context is action + employee + work date. Replays add the `Idempotent-Replayed: true` header with an identical body.
  - New code `IDEMPOTENCY_KEY_REQUIRED` (400) for a missing or malformed key.
  - An existing record is checked before the window, so a second check-in after 17:00 says `ATTENDANCE_ALREADY_CHECKED_IN`.
  - Just after midnight, checking out an open record from the previous day returns `CHECK_OUT_WINDOW_CLOSED` (not `ATTENDANCE_NOT_CHECKED_IN`).
  - `GET /v1/attendance/today` always returns 200 with a `state` (`no_profile`, `inactive`, `non_working_day`, `before_window`, `ready_to_check_in`, `window_closed`, `checked_in`, `check_out_closed`, `checked_out`) and `canCheckIn`/`canCheckOut`, matching UX_FLOWS §7.2.
  - `GET /v1/attendance/:id` returns own records only; team/organization scopes and correction history arrive with Phases 3/3B.
  - Not done here: idempotency-record cleanup job and seeded attendance history (both planned with close-day in Phase 2C).

---

### Phase 2C — Backend close-day and absence

**Status:** In review — branch `feat/phase-2c-close-day` in `backend-boilerplate` (stacked on `feat/phase-2b-attendance`); evidence below.

**Objective:** working days without check-in become `ABSENT` exactly once.

**In scope:** BullMQ scheduler at 00:05 organization time, idempotent absent insertion, batching/retry/resume, manual re-run endpoint for a date (audited), structured job logs.

**Acceptance criteria:** active scheduled employees without check-in become absent exactly once; non-working days, holidays, inactive employees, and dates outside employment are skipped; re-runs give the same result; open records stay open.

**Verification:** fixed-clock job tests, re-run idempotency test, e2e with the test database.

**Evidence (2026-10-30):**

| Commit    | Change                                                                                       |
| --------- | -------------------------------------------------------------------------------------------- |
| `4706d16` | Close-day service, `attendance-jobs` queue (tick, close-day, idempotency purge), re-run endpoint, tests, OpenAPI. |
| `cb59b25` | Seed: five working days of pilot history before today (present, late, absent, open).        |

- Verification: format, lint, typecheck pass; 86 unit tests and 164 e2e tests pass (close-day suite repeated 2×); no schema change; `openapi.json` regenerated (`POST /v1/attendance/close-day`).
- Acceptance: on a Friday with complete, open, missing, inactive, left-before and not-yet-started employees, only the missing one becomes `ABSENT` (created 1, skipped 2); a re-run creates 0 and leaves every row's version and `updatedAt` unchanged; the open record stays open; Saturday and a holiday create nothing; another organization's employees are untouched; the scheduled run is not due at 00:04:59 WIB, is due at 00:05:00, and two ticks yield one job and one audit entry.
- Decisions made during implementation:
  - A BullMQ scheduler ticks every 15 minutes (UTC) and queues `close-day` for each organization whose local time is past 00:05, for the previous work date. The job id is `close-day-<organization>-<date>` and is kept 3 days, so repeated ticks don't run it again; a missed tick is caught up by the next one on the same day. Older missed dates need the manual re-run.
  - ABSENT rows are inserted with `ON CONFLICT DO NOTHING` in batches of 200 (keyset by employee id). A failed batch is logged and counted; the job then fails and BullMQ retries it (5 attempts), and the retry only creates what's still missing.
  - ABSENT rows keep the day's schedule snapshot and `workScheduleId`, so corrections can use them.
  - `POST /v1/attendance/close-day { date }` (`policy:manage`) runs synchronously for a date before today and returns the counts. New code `CLOSE_DAY_DATE_NOT_ENDED` (422). Audited as `attendance.close_day_rerun` (actor) and, for scheduled runs, `attendance.marked_absent` (no actor), one entry per organization and date with the counts and run id.
  - Eligibility is evaluated at run time: an employee deactivated before a re-run is skipped.
  - A daily job (03:30 UTC) deletes expired idempotency records.
  - The seed history is relative to the day it runs (the last five working days in Jakarta), so it stays inside the correction window; re-running on another day adds that day's records.

---

### Phase 3 — Backend corrections and approvals

**Status:** In review — branch `feat/phase-3-corrections` in `backend-boilerplate` (stacked on `feat/phase-2c-close-day`); evidence below.

**Objective:** official, auditable corrections with first-decision-wins approval.

**In scope:**

- `CorrectionRequest` and `CorrectionSnapshot` models/migration.
- `corrections` module: submit, list own, review queue (team/org scope), detail, approve, reject.
- Seven-day window, one pending per record, reason validation, self-approval prevention (service + DB check), version conflict, atomic decision with snapshots and audit.
- Correction indicators on attendance history/detail responses.

**Mandatory RED tests:**

- Approve applies once and recalculates derived values; reject changes nothing.
- Two concurrent decisions → exactly one succeeds, the other gets `CORRECTION_ALREADY_DECIDED`.
- Requester (any role, including Admin/HR) cannot decide their own request.
- Manager cannot see or decide requests outside direct reports (404).
- Submission on day 8 is rejected; day 7 at 23:59:59 is accepted.
- Version conflict blocks approval.

**Approval gate:** simulated HR UAT on missing check-in, missing check-out, late correction, reject, and conflict scenarios.

**Evidence (2026-10-30):**

| Commit    | Change                                                                                      |
| --------- | ------------------------------------------------------------------------------------------- |
| `84d2302` | Migration D, `corrections` module (submit, own list, review queue, detail, approve, reject), `pendingCorrectionId` on attendance, tests, OpenAPI. |
| `17795cc` | Seed: one approved correction (EMP-003, late → present) and one pending (EMP-004, missing check-out). |

- Verification: format, lint, typecheck pass; 104 unit tests and 179 e2e tests pass (corrections suite repeated 3×); migrations apply to an empty database with no drift; seed run twice gives the same 2 corrections; `openapi.json` regenerated.
- Mandatory RED tests (`test/corrections.e2e-spec.ts`): approve applies once (version 1 → 2, late → present, 480 worked minutes, snapshots, audit) and a second decision gets `CORRECTION_ALREADY_DECIDED`; reject leaves the record byte-identical; approve‖approve and approve‖reject each give exactly one 200 and one 409 with one snapshot at most; an Admin/HR requester gets `CORRECTION_SELF_APPROVAL_FORBIDDEN` (and the database check refuses it too) while another Admin/HR can decide; a manager gets 404 for a non-report and for a report who became inactive; day 8 at 00:00 WIB is `CORRECTION_WINDOW_CLOSED`, day 7 at 23:59:59 is accepted; a check-out after submission makes approval `CORRECTION_VERSION_CONFLICT`.
- UAT scenarios covered by tests: missing check-in on an ABSENT record (→ late, still open), missing check-out (→ complete), late correction (→ present), reject, conflict. A walkthrough with the HR persona is still to do.
- Decisions made during implementation:
  - Routes follow ARCHITECTURE.md §8.2 (`/v1/correction-requests`). Submit and own list need `correction:submit`; the queue, detail and decisions are `@Authenticated()` with the scope checked in the service (`correction:decide_all` → organization, `correction:decide_team` → active direct reports of an active manager profile, otherwise 403 on the queue and 404 on a record). The queue never shows the caller's own requests; pending requests come oldest first.
  - One pending request per record is enforced by a unique `pending_attendance_id` column (equal to `attendance_id` while pending, null once decided, kept in step by a check constraint) instead of a partial index, which Prisma would report as drift.
  - The request stores the resulting pair (`requestedCheckInAt` always set, `requestedCheckOutAt` set when the record would have one); `changes` in the API is derived by comparing with the values at submission.
  - Proposed times must be on the work date in the record's schedule timezone and not in the future; invalid pairs return the new code `CORRECTION_TIMES_INVALID` (422) with field errors. The deadline uses the record's snapshot timezone.
  - A version conflict rolls back the whole decision, so the request stays pending; the reviewer rejects it and the employee submits a new one. The message says so.
  - Recalculation uses the shared calculator (`valuesFor`) and the record's own schedule snapshot (ABSENT rows keep one since Phase 2C). `correctedAt` keeps the first approval time.
  - Audit entries (`correction.submitted|approved|rejected`) are written right after the transaction commits, through the same event path as every other module, not inside it.
- Limitations: the audit entry is not in the decision transaction (a crash between commit and audit write would lose the entry; same for all modules). `GET /v1/attendance/:id` shows `corrected` and `pendingCorrectionId`, not the full correction history; team/organization reads of attendance come in Phase 3B.

---

### Phase 3B — Backend dashboards and reports

**Status:** In review — branch `feat/phase-3b-reports` in `backend-boilerplate` (stacked on `feat/phase-3-corrections`); evidence below.

**Objective:** read-only aggregates for team, organization, and reports.

**In scope:** team today/history (90 days), organization dashboard (active employees, present/late/absent today, pending corrections, trends), attendance report with filters and summary, trends endpoint, CSV export (Should) with formula-injection mitigation and audit.

**Acceptance criteria:** summaries reconcile with detail rows for the same filter; managers are scoped to direct reports; holidays and non-working days never count as absent; corrected values show with `corrected=true`; open rows have no final duration.

**Verification:** reconciliation tests on seeded data, scope negative tests, CSV injection test, `EXPLAIN ANALYZE` on main queries with representative volume.

**Evidence (2026-10-30):**

| Commit    | Change                                                                                      |
| --------- | ------------------------------------------------------------------------------------------- |
| `6c3d1db` | Refactor (no behavior change): shared attendance mapper, `EmployeesService.teamOf` (also used by corrections), `HolidaysService.workingDaysBetween`. |
| `b6adf15` | `reports` module: team today/history, organization dashboard, report + summary, trends, CSV export; tests; OpenAPI. |

- Verification: format, lint, typecheck pass; 114 unit tests and 189 e2e tests pass; no schema change; `openapi.json` regenerated (`/v1/team/attendance`, `/v1/team/attendance/today`, `/v1/dashboard/organization`, `/v1/reports/attendance`, `/v1/reports/attendance/trends`, `/v1/reports/attendance.csv`).
- Acceptance (`test/reports.e2e-spec.ts`): over a three-day fixture (present, late, absent, open, incomplete, corrected), the summary equals the counts recomputed from the rows for eight filters (none, division, employee, status, each completion bucket) and is unchanged across pages; trend totals equal the report summary; a holiday and the weekend show `isWorkingDay: false` with no absences; a manager sees only active direct reports (a non-report filter returns 0, a deactivated report drops out); other organizations see 0; HR without `attendance:read_team` gets 403 on team views, a manager gets 403 on the organization dashboard and the CSV; the corrected record shows `corrected: true`; open records have `workedMinutes: null`.
- CSV: BOM, the 15 columns of DOMAIN_RULES.md §13.1, one line per record of the full filtered result, `=HYPERLINK(...)` exported as `'=HYPERLINK(...)`, times in the record's zone with offset; one `report_export.created` audit entry with the filters and row count.
- `EXPLAIN ANALYZE` on a scratch database with 500 employees × 259 working days (129,500 records): report page (month) 4.6 ms, deep page of a full year 4.7 ms, full-year summary 18 ms (parallel seq scan, acceptable), division summary (quarter) 2.0 ms, team history page 0.8 ms, 6-week trend 1.1 ms (index-only), dashboard "not checked in" 0.6 ms. No new index needed.
- Decisions made during implementation:
  - `ReportsRepository` reads attendance, employees and corrections directly, read-only, as ARCHITECTURE.md §6.7 allows; writes stay in the owning modules.
  - Report and trend endpoints are `@Authenticated()` with the scope checked in the service (`report:read_all` → organization, `report:read_team` → active direct reports, otherwise 403), like the correction review queue. The CSV needs `report:read_all`.
  - Team scope = active direct reports of the caller's active employee profile; a team view without such a profile returns `EMPLOYEE_PROFILE_REQUIRED`. Team dates outside the last 90 days (or after today) return `VALIDATION_FAILED` with field errors.
  - Completion filter buckets match the summary: `open` (before the check-out deadline), `incomplete` (past it), `complete`, `not_applicable`.
  - The division filter uses the employee's current division (records don't keep a division snapshot).
  - Dashboard `absent` counts only ABSENT records; today's missing check-ins are `notCheckedIn` with `checkInWindowClosed` telling whether they're final until close-day. "Not checked out" = open past the scheduled end. The trend covers the last 30 working days ending today.
  - The CSV is streamed synchronously in batches of 1,000 (no `ReportExport` table, DATA_MODEL.md §9.1); filename `attendance-<from>-to-<to>.csv`.
- Limitations: the review screen's preview of the recalculated status and duration (UX_FLOWS.md §9.4) isn't in the correction API yet; the CSV audit entry is written after the last row, so an export aborted mid-stream isn't audited.

---

### Phase 4A — Frontend shell, branding, and auth adjustments

**Status:** In review — branch `feat/phase-4a-shell` in `frontend-boilerplate` (from `chore/hadirin-setup`) and `feat/phase-4a-me-context` in `backend-boilerplate` (stacked on `feat/phase-3b-reports`); evidence below.

**Objective:** the boilerplate looks and navigates like Hadir.in without changing its foundations.

**In scope:**

- Apply brand tokens through the existing theme (`frontend-boilerplate/docs/07-styling-and-theming.md`); text wordmark; page titles "Hadir.in".
- Permission-based navigation per `UX_FLOWS.md` §3.3; remove the example invoices pages from navigation.
- Hide registration (`REGISTRATION_ENABLED=false` in both `.env.example` files and docs).
- `/profile` page; support contact in the help menu.
- Status badge component (text + icon).

**Acceptance criteria:** existing login, logout, refresh, invite, users, and audit flows still work; contrast checks pass for brand pairs; navigation matches the role table.

**Verification:**

```bash
cd frontend-boilerplate
pnpm api:types
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm api:types:check
pnpm build
```

**Evidence (2026-10-30):**

| Repo     | Commit    | Change                                                                                                    |
| -------- | --------- | --------------------------------------------------------------------------------------------------------- |
| backend  | `fa7c96d` | `/v1/auth/me` gains `role { id, name }`; new `GET /v1/me/context` (organization name, today's time zone, support contact, own profile or null). |
| backend  | `bdd26f2` | OpenAPI fix: top-level `z.string().nullable()` was published as `string[]` (`jobTitle`, `supportContact`). |
| backend  | `d8fc3f4` | `.env.example` and docs: `REGISTRATION_ENABLED=false`.                                                     |
| frontend | `7a2be2f` | Regenerated API types; full `PERMISSIONS` list; session carries the role; role display names.             |
| frontend | `700516c` | Brand tokens (light and dark), status tones, text wordmark, `StatusBadge`, rebranded login.              |
| frontend | `68c7987` | Role-based navigation, `/me/context` in the shell, `/profile`, Get help item, placeholder pages for 4B–4D. |
| frontend | `14db4ef` | `.env.example` and docs: registration off.                                                                 |

- Verification: frontend format, lint, typecheck, 93 unit tests, `api:types:check` and `build` pass; backend lint, typecheck, format, 116 unit tests and 191 e2e tests pass, `openapi.json` regenerated.
- Acceptance:
  - Navigation: `src/config/nav.test.ts` checks the §3.3 table for the Employee, Manager and Admin/HR default roles, with and without an employee profile.
  - Contrast: `src/app/theme.test.ts` reads `globals.css` and checks 12 text/background pairs in light and dark against 4.5:1 (white on `#A50034` is 7.9:1; `#A50034` on `#F7C6C7` is 5.2:1).
  - Registration: `/register` returns 404 with the flag off; protected routes redirect to `/login?next=…` (checked in the browser).
  - Not yet checked by hand: signed-in login, logout, refresh, invite, users and audit flows. The code paths are unchanged apart from the role field, and the unit tests pass; a walkthrough with the seeded accounts is still to do.
- Decisions made during implementation:
  - The shell needs the role name, time zone, support contact and whether the user is an employee, but `GET /v1/work-settings` needs `policy:manage`. `role` was added to `/auth/me`, and the rest comes from the new `GET /v1/me/context` (any signed-in user), so the auth module doesn't depend on Hadir.in modules.
  - "With profile" in §3.3 means the user has an employee profile (active or not); attendance entries also need `attendance:self` or `correction:submit`.
  - Navigation is grouped as Overview, My attendance, Team & reports, Administration. My profile sits in the user menu and the command menu. The boilerplate's Files page stays reachable but leaves the navigation.
  - Pages from Phases 4B–4D exist as placeholders that already check permissions and profile, so the navigation never links to a 404. Each is replaced by its phase.
  - `--destructive` moved to `oklch(0.52 0.2 27)` in light mode so it meets AA on its soft background; status tones are `success`, `warning`, `info` (each with `-soft`), plus `destructive-soft`.
  - Organization time is shown in the header as "Times in WIB" (WIB/WITA/WIT for Indonesian zones, Intl short names otherwise).
  - Local `.env` files still have `REGISTRATION_ENABLED=true`; only the examples and defaults changed.

---

### Phase 4B — Frontend administration

**Status:** In review — branch `feat/phase-4b-admin` in `frontend-boilerplate` (stacked on `feat/phase-4a-shell`) and `feat/phase-4b-admin-support` in `backend-boilerplate` (stacked on `feat/phase-4a-me-context`); evidence below.

**Objective:** Admin/HR manages employees, divisions, settings, and holidays through the UI.

**In scope:** `/employees` (list, new, detail/edit, deactivate/reactivate, manager and role assignment, invite), `/divisions`, `/settings/attendance` (with boundary preview and confirmation), `/holidays`; URL filters; loading/empty/error/forbidden/responsive states.

**Acceptance criteria:** all backend CRUD is usable; number/email conflicts map to the right field; filters persist in the URL; the UI never offers retroactive schedule dates; keyboard and automated accessibility checks pass on main flows.

**Evidence (2026-10-30):**

| Repo     | Commit    | Change                                                                                                   |
| -------- | --------- | -------------------------------------------------------------------------------------------------------- |
| backend  | `25df0f9` | Divisions report `activeEmployeeCount`; deactivating one with active employees returns 409 `DIVISION_HAS_ACTIVE_EMPLOYEES`. |
| backend  | `54e620e` | `/v1/me/context` includes the organization's `workDate`.                                                 |
| frontend | `ca18cb4` | `/divisions`, plus shared `SelectField`, `ListSearch`, `expectedFailure` (error code → approved copy).    |
| frontend | `8ab3802` | `/employees`, `/employees/new`, `/employees/:id` with the account card.                                  |
| frontend | `3e9d6fe` | `/holidays`, one year at a time.                                                                         |
| frontend | `7c907c2` | `/settings/attendance` with preview, conflict warning and old/new confirmation.                          |
| frontend | `cd59237` | Form schemas accept their own output (found in the browser check), org date from `/me/context`, axe tests. |

- Verification: frontend format, lint, typecheck, 156 unit tests (20 files), `api:types:check` and `build` pass; backend lint, format, typecheck, 116 unit tests and 192 e2e tests pass; `openapi.json` regenerated.
- Browser check, signed in as the owner of a throwaway seeded database (dropped afterwards): added an employee (taken number shown on the number field after uppercasing, then created with an invitation and redirected to the detail page), changed the manager through the access confirmation, saw a division with an employee offer "View its employees" instead of deactivating, added a past holiday with the warning, previewed and scheduled a schedule version (the current one closed the day before, the upcoming one shown, and the form then warned about the planned version). Users and the audit log still load. No horizontal scroll at 375 px on the employees and settings pages.
- Acceptance:
  - CRUD: divisions (create, edit, deactivate, reactivate), employees (create, edit, deactivate, reactivate, invite, link, change role, resend invitation), holidays (create, edit, remove), organization settings and schedule versions are all reachable.
  - Conflicts: `EMPLOYEE_NUMBER_TAKEN`, `DIVISION_CODE_TAKEN`/`NAME_TAKEN`, `HOLIDAY_DATE_CONFLICT`, `REPORTING_LINE_CYCLE`, `EMAIL_TAKEN`, `SCHEDULE_*` map to their fields (action tests).
  - URL state: employees (q, division, manager, status, sort, page), divisions (q, status, sort, page), holidays (year).
  - No retroactive dates: the effective-date input starts at `earliestEffectiveFrom`, earlier dates are refused before submit, and a planned version disables dates on or before it.
  - Accessibility: `src/app/admin-forms.a11y.test.tsx` runs axe-core (WCAG 2.1 A/AA) on every admin form and dialog, with a self-check that it catches an unlabelled input. Colour contrast stays in `theme.test.ts`. Keyboard use was exercised in the browser for menus and dialogs; a screen-reader pass is still to do.
- Decisions made during implementation:
  - Add employee creates the employee, then, if a role is chosen, links the existing account with the work email or sends an invitation. If only the account step fails, the employee is kept and the detail page offers the account step again (an email conflict can only be detected at that step).
  - Account actions need `user:manage` as well as `employee:manage`; without it the account card is read-only and the role field is hidden.
  - Manager, division and role options load one page of 100 (enough for the pilot); a searchable picker replaces them if that's outgrown.
  - The check-out deadline is entered as a minute and covers it entirely ("23:59" is sent as 23:59:59.999, the baseline). Time zones offered: Asia/Jakarta, Asia/Makassar, Asia/Jayapura and the current one.
  - Deactivating a division with active employees is refused by the backend (new rule, DOMAIN_RULES §4.4) and the UI links to those employees instead.
  - Pages take "today" from `/me/context` (`workDate`), never from the server or browser clock.
  - `axe-core` (already installed through `eslint-plugin-jsx-a11y`) is now a direct dev dependency.

---

### Phase 4C — Frontend attendance and employee dashboard

**Status:** In review — branch `feat/phase-4c-attendance` in `frontend-boilerplate` (stacked on `feat/phase-4b-admin`) and `feat/phase-4c-attendance-support` in `backend-boilerplate` (stacked on `feat/phase-4b-admin-support`); evidence below.

**Objective:** employees check in/out and understand the result on mobile and desktop.

**In scope:** employee dashboard (`UX_FLOWS.md` §6.1), `/attendance` with every state in §7, client action island with pending state and idempotency key, check-out confirmation, `/attendance/history` daily and monthly views with filters and summary, `/attendance/:id`, error-code mapping, ambiguous-response recovery.

**Acceptance criteria:** every state in `UX_FLOWS.md` §7–8 renders and is tested where relevant; double-clicks never create two intents; organization time is labeled and never used as client-side authority; employees see only their own history.

**Evidence (2026-10-30):**

| Repo     | Commit    | Change                                                                                                   |
| -------- | --------- | -------------------------------------------------------------------------------------------------------- |
| backend  | `c1f819d` | `GET /v1/correction-requests/me?attendanceId=` lists one record's requests (its correction history).    |
| backend  | `935f36c` | `GET /v1/attendance/me?incomplete=true` lists open records past their check-out deadline.               |
| frontend | `dfb2a52` | API types refreshed.                                                                                     |
| frontend | `69b1aaf` | `/attendance` today card (every §7.2 state), check-in/out actions with idempotency keys, ambiguous-result recovery, employee `/dashboard`. |
| frontend | `6202512` | `/attendance/history` (daily list and monthly calendar, URL filters, summary) and `/attendance/:id` with correction history. |

- Verification: frontend format, lint, typecheck, 210 unit tests (25 files), `api:types:check` and `build` pass; backend lint, format, typecheck, 116 unit tests and 192 e2e tests pass; `openapi.json` regenerated.
- Browser check on a throwaway seeded database (dropped afterwards; its check-in window was widened to 23:00 so the real flow could run after 17:00): as an employee, double-clicked Check in (one POST reached the backend, one record), saw Late with the API's late minutes, the toast and the announcement; checked out through the confirmation dialog and saw both times and the duration; history filters (reversed range refused before any request, edited URL refused on the server, status and Incomplete filters, empty state with Reset filters); monthly calendar; a record with an approved correction shows original vs requested and the decision; another employee's record and a malformed ID are "not found"; the owner (no employee profile) sees the Contact Admin/HR state on the dashboard, `/attendance` and `/attendance/history`. At 375 px: the Check in button is 44 px high above the fold, history becomes cards, and nothing scrolls sideways.
- Acceptance:
  - Every §7.2 state has a design and a test (`today-view.test.ts`, `today-card.test.tsx`); §7.3 late copy uses `lateMinutes`; §8 empty states and range validation are tested (`dates.test.ts`).
  - Double clicks: a ref guard plus the pending state send one action per intent; the intent's key is reused for retries and dropped once the result is known (`today-card.test.tsx`).
  - Ambiguous results (timeout, network, 5xx) re-check today's state before offering anything; a check-in that turned out recorded is reported as recorded, otherwise the retry reuses the key; if the state can't be read, only "Check my status" is offered.
  - Organization time: the clock is seeded from `serverTime`, labeled ("Organization time … WIB"), and display-only; "today" comes from the server (`workDate`); boundary re-checks are scheduled from server times and the backend still decides.
  - Own history only: every read goes to `/attendance/me…` or `/attendance/:id`, which the backend scopes to the caller.
- Decisions made during implementation:
  - Today's card re-checks through TanStack Query and a route handler (`/api/attendance/today`): every 5 minutes while the tab is visible, on focus, at the next check-in/check-out boundary, and after an unconfirmed action (docs/08-data-fetching.md).
  - The "Request correction" CTA shows while no request is pending and the organization's date is within seven days of the work date; the backend still enforces the deadline. `/corrections/new` and `/corrections/:id` are Phase 4D placeholders.
  - Users without an employee profile get a placeholder dashboard until the manager and Admin/HR dashboards land in 4D.

---

### Phase 4D — Frontend corrections, team, dashboards, and reports

**Status:** In review — branch `feat/phase-4d` in `frontend-boilerplate` (stacked on `feat/phase-4c-attendance`) and `feat/phase-4d-support` in `backend-boilerplate` (stacked on `feat/phase-4c-attendance-support`); evidence below.

**Objective:** corrections, manager and HR views, and reporting are usable end to end.

**In scope:** `/corrections`, `/corrections/new`, `/corrections/:id`, `/corrections/review`, `/team`, manager and Admin/HR dashboards with trend chart (Recharts), `/reports` with filters, summary, trend, and CSV export.

**Acceptance criteria:** comparison layout shows current vs proposed; no decision buttons on own requests; an already-decided request shows who/when; dashboard numbers match their linked lists; manager views are team-scoped.

**Evidence (2026-10-30):**

| Repo     | Commit    | Change                                                                                                   |
| -------- | --------- | -------------------------------------------------------------------------------------------------------- |
| backend  | `e076c90` | Correction responses carry the record's time zone and before/after outcomes (status, lateness, duration); `POST /v1/correction-requests/preview`; review queue `divisionId` filter. |
| frontend | `795ab7d` | API types refreshed.                                                                                     |
| frontend | `09124ed` | Shared record schema, formats, badges and date helpers moved to `lib/` and `components/shared` (features don't import each other). |
| frontend | `5d9e886` | `/corrections/new` with server preview, `/corrections`, `/corrections/:id` with the comparison and decisions. |
| frontend | `b31c504` | `/corrections/review`, `/team`, `/team/:employeeId`, manager and Admin/HR dashboards with the trend chart, `/reports` with CSV export. |

- Verification: frontend format, lint, typecheck, 239 unit tests (30 files), `api:types:check` and `build` pass; backend lint, format, typecheck, 118 unit tests and 195 e2e tests pass; `openapi.json` regenerated.
- Browser check on a throwaway seeded database (dropped afterwards):
  - As an employee: requested a correction for a past day (the server preview showed 8h 40m becoming 9h 02m), was redirected to the pending request, and saw it under My corrections.
  - As the manager: the dashboard showed team cards, this week's late/absent days, pending requests with Review links and the direct-report list. Approved the request through the confirmation; the page then showed "Approved by Rina Wijaya" with the time. On another request, approved it as Admin/HR through the API while the manager's page was open; the manager's Reject didn't apply and the page showed "Approved by Indah Permata". `/team` for a past date: the Late card listed exactly its one member. Team-scoped `/reports`.
  - As Admin/HR, in dark mode: the organization cards, division/employee filters, the trend chart with legend and tooltip, and the CSV export (200, `text/csv`, attachment name, header plus 51 rows).
  - No horizontal scroll at 375 px on reports, the review queue and the dashboard.
- Acceptance:
  - Comparison: `/corrections/:id` and the request preview show check-in, check-out, status, lateness and duration, current vs proposed, as calculated by the server (`CorrectionComparison` test).
  - No decision buttons on own requests: the panel renders only when the server says `canDecide`; the requester sees "Waiting for a decision" (and "You can't decide your own request" if they're a reviewer).
  - Already decided: the action re-reads the request and returns "already approved/rejected by {name} on {time}" (action test); the page refreshes to the decision.
  - Numbers match their lists: team cards use the server's summary rules (`team.test.ts`); dashboard and report counts link to reports filtered the same way; numbers without a list behind them (not checked in, not checked out) carry an explanation instead of a link.
  - Team scope: `/team`, the manager dashboard, the review queue and reports use the backend's team-scoped endpoints; `/team/:id` 404s for anyone not on today's team list.
- Decisions made during implementation:
  - The trend chart uses its own palette (`--trend-*`, validated for colour-vision deficiency in light and dark), not the status-badge colours, which fail as adjacent chart fills. Light-mode fills are under 3:1 against white, so the chart always has a legend, a tooltip and a table view.
  - A CSS comment placed before the `--trend-*` tokens made Next's CSS pipeline drop them from the build. The comment was removed and the tokens are documented in `trend-chart.tsx`; the production build was checked for them.
  - The CSV export goes through a route handler (`/api/reports/attendance-csv`) that streams the backend response; it needs `report:read_all`, as the backend does.
  - Dashboards re-render every minute while visible and on returning to the tab, with "Last updated" and a Refresh button.
  - Managers' "Approve/Reject shortcuts" are Review links to the request page, where the decision is made with the full comparison.

---

### Phase 5 — Verification, documentation, and pilot walkthrough

**Status:** Not started

**Objective:** prove the integrated application works locally and is documented.

**In scope:**

- Full regression in both repositories.
- End-to-end walkthrough of `UX_FLOWS.md` §23 with the demo seed.
- Security review: auth, permissions, IDOR, mass assignment, CSRF, rate limits, logging.
- Business-rule verification against `DOMAIN_RULES.md` §17 scenarios.
- Fix defects found.
- Documentation (PRD §17): update each repo's README/docs for overview, architecture, local setup (`docker compose`, `hadirin` database/project name), environment variables, migrations, seed, API docs (OpenAPI), permission matrix, business rules, testing, demo accounts, known limitations.
- Verify a clean local setup from scratch following only the README.

**Acceptance criteria:**

- No open critical/high defects.
- Demo seed reproduces the pilot scenario (Engineering, 10 employees, five working days).
- A fresh clone can be set up and demoed using only the documentation.
- The simulated HR reviewer signs off the walkthrough.

## 7. Cross-cutting verification matrix

| Concern        | Minimum evidence                                                                 |
| -------------- | -------------------------------------------------------------------------------- |
| Authentication | Invalid, expired, revoked session tests.                                         |
| Authorization  | Missing permission, own/team/all scope, self-approval, cross-tenant negatives.   |
| Time           | Fixed-clock boundaries, timezone conversion, midnight, UTC/Jakarta, effective periods. |
| Concurrency    | Parallel check-in/out, schedule versions, correction decisions.                  |
| Idempotency    | Same-key replay, key context mismatch, retry after response loss.                |
| Data integrity | Database constraints plus service validation tests.                              |
| Migration      | Empty database and upgrade-from-previous-state runs.                             |
| API contract   | OpenAPI diff and frontend type regeneration.                                     |
| Accessibility  | Keyboard, focus, labels, live regions, contrast, automated scan.                 |
| Performance    | Representative dataset; p95 transaction/dashboard/report evidence.               |
| Reliability    | Queue retry, partial failure, re-run.                                            |
| Privacy        | Data minimization, retention setting, audit, export access, no secret/PII logs.  |

## 8. Release strategy

```text
Local implementation
  → focused tests
  → repository-wide checks
  → local commit
  → review (Developer)
  → local integrated walkthrough
  → staging (only if available, with approval)
```

Push, pull requests, and deployment happen only with explicit approval. Production is out of scope.

## 9. Future scope gates

These are not part of this plan (PRD §13). Each needs a separate decision and its own phase with detailed acceptance criteria: advanced schedules and shifts, leave and multi-level approval, notifications, SSO and integrations, location/selfie verification (privacy gate first), analytics and PWA/mobile.

## 10. Evidence template

Use this at each phase handoff:

```markdown
## Phase N evidence

- Status:
- Scope completed:
- Files/modules changed:
- Commits (repo, hash, subject):
- Migration(s):
- API contract changes:
- Tests added:
- Commands run and observed results:
- Manual/UAT checks:
- Security/privacy checks:
- Known limitations:
- Follow-ups intentionally deferred:
- Approved by:
- Recommended next phase:
```

Never write "all tests pass" without listing the commands actually run and their results.

## 11. Plan maintenance

- Update roadmap status when a phase starts, blocks, enters review, or completes.
- Do not rewrite old evidence; correct it with a dated note.
- New product decisions go into the PRD and are referenced from the plan.
- Formula changes go into domain rules before the implementation changes.
- System boundary changes go into architecture.
- Persistence changes go into the data model and migration sequence.
