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
|     1 | Backend foundation: roles/permissions, divisions, employees     | Not started | 0              |
|    2A | Backend work settings, schedule versions, holidays              | Not started | 1              |
|    2B | Backend attendance core (check-in/out, history, summaries)      | Not started | 2A             |
|    2C | Backend close-day job and absence                               | Not started | 2B             |
|     3 | Backend corrections and approvals                               | Not started | 2B             |
|    3B | Backend dashboards and reports                                  | Not started | 2C, 3          |
|    4A | Frontend shell, branding, auth adjustments, profile             | Not started | 1              |
|    4B | Frontend employees, divisions, settings, holidays               | Not started | 4A, 2A         |
|    4C | Frontend attendance, history, employee dashboard                | Not started | 4A, 2B         |
|    4D | Frontend corrections, team, manager/HR dashboards, reports      | Not started | 4C, 3, 3B      |
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

**Status:** Not started

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

---

### Phase 2A — Backend work settings, schedules, and holidays

**Status:** Not started

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

---

### Phase 2B — Backend attendance core

**Status:** Not started

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

---

### Phase 2C — Backend close-day and absence

**Status:** Not started

**Objective:** working days without check-in become `ABSENT` exactly once.

**In scope:** BullMQ scheduler at 00:05 organization time, idempotent absent insertion, batching/retry/resume, manual re-run endpoint for a date (audited), structured job logs.

**Acceptance criteria:** active scheduled employees without check-in become absent exactly once; non-working days, holidays, inactive employees, and dates outside employment are skipped; re-runs give the same result; open records stay open.

**Verification:** fixed-clock job tests, re-run idempotency test, e2e with the test database.

---

### Phase 3 — Backend corrections and approvals

**Status:** Not started

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

---

### Phase 3B — Backend dashboards and reports

**Status:** Not started

**Objective:** read-only aggregates for team, organization, and reports.

**In scope:** team today/history (90 days), organization dashboard (active employees, present/late/absent today, pending corrections, trends), attendance report with filters and summary, trends endpoint, CSV export (Should) with formula-injection mitigation and audit.

**Acceptance criteria:** summaries reconcile with detail rows for the same filter; managers are scoped to direct reports; holidays and non-working days never count as absent; corrected values show with `corrected=true`; open rows have no final duration.

**Verification:** reconciliation tests on seeded data, scope negative tests, CSV injection test, `EXPLAIN ANALYZE` on main queries with representative volume.

---

### Phase 4A — Frontend shell, branding, and auth adjustments

**Status:** Not started

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

---

### Phase 4B — Frontend administration

**Status:** Not started

**Objective:** Admin/HR manages employees, divisions, settings, and holidays through the UI.

**In scope:** `/employees` (list, new, detail/edit, deactivate/reactivate, manager and role assignment, invite), `/divisions`, `/settings/attendance` (with boundary preview and confirmation), `/holidays`; URL filters; loading/empty/error/forbidden/responsive states.

**Acceptance criteria:** all backend CRUD is usable; number/email conflicts map to the right field; filters persist in the URL; the UI never offers retroactive schedule dates; keyboard and automated accessibility checks pass on main flows.

---

### Phase 4C — Frontend attendance and employee dashboard

**Status:** Not started

**Objective:** employees check in/out and understand the result on mobile and desktop.

**In scope:** employee dashboard (`UX_FLOWS.md` §6.1), `/attendance` with every state in §7, client action island with pending state and idempotency key, check-out confirmation, `/attendance/history` daily and monthly views with filters and summary, `/attendance/:id`, error-code mapping, ambiguous-response recovery.

**Acceptance criteria:** every state in `UX_FLOWS.md` §7–8 renders and is tested where relevant; double-clicks never create two intents; organization time is labeled and never used as client-side authority; employees see only their own history.

---

### Phase 4D — Frontend corrections, team, dashboards, and reports

**Status:** Not started

**Objective:** corrections, manager and HR views, and reporting are usable end to end.

**In scope:** `/corrections`, `/corrections/new`, `/corrections/:id`, `/corrections/review`, `/team`, manager and Admin/HR dashboards with trend chart (Recharts), `/reports` with filters, summary, trend, and CSV export.

**Acceptance criteria:** comparison layout shows current vs proposed; no decision buttons on own requests; an already-decided request shows who/when; dashboard numbers match their linked lists; manager views are team-scoped.

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
