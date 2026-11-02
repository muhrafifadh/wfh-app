# Product Requirements Document — Hadir.in

| Attribute            | Value                                                          |
| -------------------- | -------------------------------------------------------------- |
| Product              | Hadir.in — Work From Home (WFH) Attendance Management System   |
| Status               | Approved product baseline for implementation                   |
| Version              | 0.3                                                            |
| Date                 | 30 October 2026                                                |
| Product owner        | Developer                                                      |
| Platform             | Responsive web application                                     |
| Target users         | Employee, Manager, Admin/HR                                    |
| Application language | English                                                        |
| Organization time    | `Asia/Jakarta` (UTC+7)                                         |
| Precedence           | The official take-home assignment brief wins on any conflict.  |

## 1. Summary

Hadir.in is a web-based attendance system for employees who work from home. It replaces manual attendance tracking (chat, spreadsheets, ad-hoc forms) with one consistent, server-authoritative attendance record, gives managers and HR operational visibility, provides an official correction workflow, and produces reports for monthly administration.

### 1.1 Core development principle

**Hadir.in is built on top of the existing `backend-boilerplate` and `frontend-boilerplate` repositories. It is not rebuilt from scratch.**

The boilerplates are the source of truth for technical decisions. All work follows their existing architecture, technology stack, coding conventions, project structure, authentication, database patterns, API conventions, and UI component system. Existing functionality is not replaced, restructured, or rewritten without a clear technical reason.

The objective is to extend and complete the boilerplates into a functional, maintainable, production-oriented application. Scope and quality are driven by the requirements in this document and implementation correctness, not by a fixed three-to-five-day schedule.

## 2. Background and problem

WFH attendance recorded through chat, spreadsheets, or separate forms causes several problems:

- Recorded times are inconsistent and may depend on the user's device clock.
- HR has to compile attendance data manually.
- Check-in and check-out mistakes are hard to fix in an orderly way.
- Managers have no quick view of team attendance.
- Changes to data are not always traceable.

## 3. Product goals

### 3.1 Primary goals

- Let employees record daily check-in and check-out easily and accurately.
- Make server time the official time source.
- Prevent duplicate records and keep attendance data consistent.
- Let managers and HR monitor attendance and correct it through an official workflow.
- Produce attendance reports without manual processing.
- Provide a foundation that can later support more complex work policies and integrations.

### 3.2 Initial success targets

- At least 95% of working-day attendance is recorded through the system within 30 days of launch.
- At least 90% of active employees use the system without assistance after the first week.
- Median time to check in or check out is under 30 seconds.
- Zero duplicate attendance records for the same employee and work date.
- Every change to attendance made through a correction is traceable.
- HR monthly report preparation time is reduced by at least 80%.

Targets may be adjusted once an operational baseline exists.

## 4. Non-goals

The following are not part of the current scope:

- Payroll calculation or automatic payroll deductions.
- Activity, productivity, screen, or computer-usage tracking.
- Continuous location tracking, face recognition, or biometric matching. Approved-area location and check-in selfies stay out of scope too, unless legally approved and enabled per decision 26.
- Native mobile applications.
- Shifts that cross midnight, per-division or per-employee schedules, flexible hours.
- Leave, sick, and time-off requests; multi-level approval.
- Notifications, SSO, HRIS/payroll integrations, and public APIs/webhooks.
- Self-registration. Accounts are created by Admin/HR.

These remain candidates for future scope (see §13) and must not be built unless approved.

## 5. Product policy

All attendance policies are enforced on the backend. Timestamps are stored in UTC; work dates and attendance statuses are calculated in the organization timezone.

| #   | Policy                         | Decision                                                                                     |
| --- | ------------------------------ | -------------------------------------------------------------------------------------------- |
| 1   | Organization timezone          | `Asia/Jakarta` (UTC+7).                                                                      |
| 2   | Default working schedule       | Monday–Friday, 09:00–17:00.                                                                  |
| 3   | Late tolerance                 | 15 minutes.                                                                                  |
| 4   | Check-in window                | 08:00–17:00 on the work date.                                                                |
| 5   | Check-out deadline             | 23:59:59 on the same work date.                                                              |
| 6   | Weekend and holiday attendance | Rejected.                                                                                    |
| 7   | Forgotten attendance           | The employee submits an official correction request.                                         |
| 8   | Correction approval            | Direct Manager or Admin/HR; the first valid decision is final.                               |
| 9   | Correction deadline            | Seven calendar days after the work date.                                                     |
| 10  | Attendance data retention      | Five years; configurable and subject to legal review before production.                      |

## 6. Users and access

| #   | Topic                     | Decision                                                                              |
| --- | ------------------------- | ------------------------------------------------------------------------------------- |
| 11  | Initial roles             | Employee, Manager, Admin/HR.                                                          |
| 12  | Admin/HR attendance       | Allowed when the account is linked to an employee profile.                            |
| 13  | Organization model        | Single organization with tenant-ready architecture (`organizationId` on domain data). |
| 14  | Employee number format    | Uppercase letters, numbers, and hyphens, e.g. `EMP-001`.                              |
| 15  | Employee data source      | Manual employee management by Admin/HR, plus seed data.                               |

### 6.1 Personas

- **Employee** — wants to check in and out quickly, see today's status and whether they are late, review personal history, and fix mistakes through a correction request.
- **Manager** — wants to see direct-report attendance, know who has not checked in or out, and decide corrections they are responsible for. A manager linked to an employee profile also uses all Employee features.
- **Admin/HR** — manages employees, divisions, roles, reporting lines, policies, and holidays; monitors the whole organization; decides corrections; reviews reports and audit history.

### 6.2 Role permissions

**Employee**

- Check in and check out.
- View personal attendance records and summaries.
- Submit attendance correction requests and track their status.
- View personal profile.

**Manager**

- All Employee features when linked to an employee profile.
- View direct-report attendance and team summaries.
- Review and decide correction requests for direct reports.

**Admin/HR**

- Manage employees, divisions, roles, and reporting relationships.
- View organization-wide attendance.
- Manage attendance policies and holidays.
- Review and decide correction requests.
- Access reports and audit history.

### 6.3 Access matrix

| Capability                          | Employee | Manager                  | Admin/HR                          |
| ----------------------------------- | :------: | :----------------------: | :-------------------------------: |
| Own check-in/check-out              |   Yes    | Yes, with profile        | Yes, with profile                 |
| View own history and summaries      |   Yes    | Yes                      | Yes                               |
| Submit own correction               |   Yes    | Yes                      | Yes                               |
| View direct-report attendance       |    No    | Yes                      | Yes (whole organization)          |
| Decide corrections                  |    No    | Direct reports only      | Yes                               |
| Decide own correction               |    No    | No                       | No                                |
| Manage employees/divisions/roles    |    No    | No                       | Yes                               |
| Manage policies and holidays        |    No    | No                       | Yes                               |
| Organization reports                |    No    | Team only                | Yes                               |
| Audit history                       |    No    | No                       | Yes                               |

Backend permissions are the source of truth. Hiding menu items in the frontend is not a security control.

Authentication and authorization reuse the boilerplate's existing auth, user, role, session, guard, and permission infrastructure. No parallel authentication or role-management system is introduced. New capabilities are added as permissions in the existing permission model.

## 7. Product experience

### 7.1 Language

All interfaces, navigation, forms, validation messages, notifications, statuses, dashboards, and documentation use English.

### 7.2 Naming

| Purpose                | Value      |
| ---------------------- | ---------- |
| Display name           | Hadir.in   |
| Application identifier | `hadir-in` |
| Database name          | `hadirin`  |
| Docker project name    | `hadirin`  |

Existing repository names (`backend-boilerplate`, `frontend-boilerplate`) and infrastructure identifiers are preserved unless renaming is necessary and safe. (After Phase 5 the two apps moved into one repository, `hadir-in`, as `backend/` and `frontend/`; runtime identifiers such as the JWT issuer and audience defaults are unchanged.)

### 7.3 Branding

| Purpose         | Hex       |
| --------------- | --------- |
| Primary         | `#A50034` |
| Secondary       | `#D50032` |
| Accent          | `#B22234` |
| Background      | `#FFFFFF` |
| Soft background | `#F7C6C7` |

- Modern, professional enterprise SaaS interface.
- Branding is applied by extending the frontend's existing design tokens and theme (Tailwind + shadcn/ui), not by replacing the styling system.
- Primary color for main actions and active navigation; soft background for subtle highlights.
- Accessible contrast (WCAG 2.1 AA where feasible) and clear semantic status indicators; color is never the only status signal.
- Responsive across desktop, tablet, and mobile.
- Logo: a professional text-based "Hadir.in" wordmark until an official logo exists.
- Support contact: configurable.

### 7.4 Pilot

| Item           | Value                                          |
| -------------- | ---------------------------------------------- |
| Division       | Engineering                                    |
| Employees      | 10 demonstration employees                     |
| Duration       | Five working days                              |
| Data           | Realistic fictional seed data                  |

The pilot duration is a demonstration setting, not an implementation deadline.

## 8. Functional requirements

Priorities: **Must** is required for the baseline; **Should** is expected unless a documented trade-off is approved.

### 8.1 Authentication and authorization

| ID     | Requirement                                                                 | Priority |
| ------ | --------------------------------------------------------------------------- | -------- |
| AUTH-01 | Users can log in with valid credentials and log out of the active session. | Must     |
| AUTH-02 | Secure session management reusing the boilerplate's token/session model.   | Must     |
| AUTH-03 | Role-based access control for Employee, Manager, and Admin/HR.             | Must     |
| AUTH-04 | All domain API endpoints are authenticated and permission-checked.         | Must     |
| AUTH-05 | Frontend navigation and pages are role-aware.                              | Must     |

### 8.2 Employee and division management

| ID     | Requirement                                                                                  | Priority |
| ------ | -------------------------------------------------------------------------------------------- | -------- |
| EMP-01 | Admin/HR can create, view, update, activate, and deactivate employees.                       | Must     |
| EMP-02 | Admin/HR can create and update divisions and assign employees to a division.                 | Must     |
| EMP-03 | Admin/HR can assign a direct manager to each employee.                                       | Must     |
| EMP-04 | Admin/HR can assign roles to user accounts.                                                  | Must     |
| EMP-05 | Employee profiles link to existing user accounts; existing user entities are extended, not duplicated. | Must |
| EMP-06 | Users can view their own employee profile.                                                   | Must     |

### 8.3 Attendance management

| ID     | Requirement                                                                                      | Priority |
| ------ | ------------------------------------------------------------------------------------------------ | -------- |
| ATT-01 | An active employee can check in for the current work date.                                       | Must     |
| ATT-02 | A checked-in employee can check out on the same record.                                          | Must     |
| ATT-03 | Check-in and check-out timestamps are generated by the server and cannot be supplied by the client. | Must  |
| ATT-04 | The system sets `PRESENT` or `LATE` at check-in based on schedule and tolerance.                 | Must     |
| ATT-05 | The system calculates working duration for complete records.                                     | Must     |
| ATT-06 | At most one check-in and one check-out per employee per work date (database-enforced).           | Must     |
| ATT-07 | Check-in outside the window, and check-out after the deadline, are rejected.                     | Must     |
| ATT-08 | Check-in on weekends and holidays is rejected.                                                   | Must     |
| ATT-09 | Missing check-outs remain incomplete after the deadline and are fixed via correction.            | Must     |
| ATT-10 | A close-day job marks working days without check-in as `ABSENT`.                                 | Must     |

### 8.4 Attendance history

| ID     | Requirement                                                     | Priority |
| ------ | --------------------------------------------------------------- | -------- |
| HIS-01 | Employees can view their personal attendance history, newest first, paginated. | Must |
| HIS-02 | Daily and monthly views.                                        | Must     |
| HIS-03 | Date-range and attendance-status filters.                       | Must     |
| HIS-04 | Attendance summaries (present, late, absent, incomplete, total duration). | Must |
| HIS-05 | Records show a correction indicator when a correction exists.   | Must     |

### 8.5 Attendance corrections

| ID     | Requirement                                                                                       | Priority |
| ------ | ------------------------------------------------------------------------------------------------- | -------- |
| COR-01 | Employees can submit a correction with a reason and proposed check-in and/or check-out values.    | Must     |
| COR-02 | Correction statuses: `PENDING`, `APPROVED`, `REJECTED`.                                           | Must     |
| COR-03 | The direct manager or Admin/HR can approve or reject with a decision note.                        | Must     |
| COR-04 | First decision wins; concurrent decisions cannot both succeed.                                    | Must     |
| COR-05 | Requesters cannot decide their own corrections.                                                   | Must     |
| COR-06 | Original and corrected values, requester, decider, and decision time are preserved.               | Must     |
| COR-07 | All correction actions are recorded in audit history.                                             | Must     |
| COR-08 | Users can track the status and history of their own corrections.                                  | Must     |

### 8.6 Dashboards

**Employee dashboard (Must)** — current date and time (server-based), today's status, check-in/check-out actions, recorded times, working duration, attendance summary, recent history, correction request status.

**Manager dashboard (Must)** — team attendance overview, direct-report records, late and absent summaries, pending corrections, approval actions.

**Admin/HR dashboard (Must)** — total active employees; employees present, late, and absent today; pending corrections; attendance trends; employee and division filters; organization-wide attendance reporting.

### 8.7 Reporting

| ID     | Requirement                                                                       | Priority |
| ------ | --------------------------------------------------------------------------------- | -------- |
| REP-01 | Admin/HR can view attendance reports by date range.                               | Must     |
| REP-02 | Reports filter by employee and division; Managers see only their team.            | Must     |
| REP-03 | Reports summarize present, late, absent, and incomplete counts and working duration. | Must  |
| REP-04 | Summary figures reconcile with record-level data for the same filter.            | Must     |
| REP-05 | Admin/HR can export the filtered report to CSV.                                   | Should   |

### 8.8 Attendance configuration

| ID     | Requirement                                                                              | Priority |
| ------ | ---------------------------------------------------------------------------------------- | -------- |
| CFG-01 | Admin/HR can configure working days and working hours.                                   | Must     |
| CFG-02 | Admin/HR can configure late tolerance, check-in window, and check-out deadline.          | Must     |
| CFG-03 | Admin/HR can manage public holidays.                                                     | Must     |
| CFG-04 | Policy changes apply to future dates only and never silently recalculate history.        | Must     |
| CFG-05 | Support contact is configurable.                                                         | Should   |

## 9. Business rules

Normative formulas, boundaries, and error codes live in [`DOMAIN_RULES.md`](DOMAIN_RULES.md). The rules below are the product-level summary.

### 9.1 Check-in and check-out

- Only active employees with a linked profile can check in, and only on working days.
- One attendance record per `employeeId + workDate`, enforced by a unique constraint.
- The work date is derived from server time in `Asia/Jakarta`, regardless of the user's device timezone.
- Check-in is allowed from 08:00:00 to 17:00:00, inclusive at both ends; requests outside the window are rejected.
- Status is `LATE` when server check-in time is later than start time + tolerance (09:15:00). Checking in exactly at 09:15:00 is `PRESENT`.
- Check-out requires an existing check-in and no prior check-out, and must occur by 23:59:59 on the work date.
- Double-clicks and network retries must not create duplicate data (idempotency, transactions, and constraints).
- Employees cannot change their own timestamps or status directly.
- Working duration = check-out − check-in; it is not a measure of productive work.

### 9.2 Missing check-out and absence

- A record with check-in but no check-out after the deadline is **incomplete**; it has no final duration and can be fixed only through a correction.
- A close-day job runs at 00:05 `Asia/Jakarta` for the previous date and marks working days with no check-in as `ABSENT`. The job is safe to re-run.
- Weekends and holidays are never counted as absent.

### 9.3 Corrections

- A reason is required.
- Submission is allowed up to seven calendar days after the work date.
- Only one `PENDING` correction per attendance record at a time.
- Attendance changes only when a correction is approved; rejection leaves attendance unchanged.
- Approval applies the change atomically and stores before/after snapshots.
- The first valid decision is final; later decisions fail with a conflict. Final decisions cannot be edited; further changes require a new request.
- The requester can never decide their own request, regardless of role.

### 9.4 Statuses

- Attendance status: `PRESENT`, `LATE`, `ABSENT` (and `EXCUSED`, reserved for future leave support).
- Completion is tracked separately from status: `NOT_STARTED`, `OPEN`, `COMPLETE`, `NOT_APPLICABLE`. "Not checked in", "not checked out", and "incomplete" are operational indicators, not attendance statuses.

### 9.5 History and configuration

- Attendance stores a snapshot of the schedule used, so historical records are not recalculated when policy changes.
- If the organization timezone changes, historical records keep their original timestamps and the timezone used at recording time.

## 10. Conceptual data model

Existing boilerplate entities (`Organization`, `User`, roles, sessions, `AuditLog`) are extended rather than duplicated. Minimum domain entities:

- **Division** — name, code, status.
- **Employee** — employee number, name, work contact, status, start/end dates, linked user, division, direct manager.
- **WorkSchedule** — working days, start/end times, tolerance, check-in window, check-out deadline, timezone, effective period.
- **Holiday** — date, name, organization, status.
- **Attendance** — employee, work date, check-in, check-out, status, schedule snapshot, source.
- **CorrectionRequest** — attendance, requester, proposed values, reason, status, decider, decision note, decision time.
- **CorrectionSnapshot** — values before and after approval.
- **AuditLog** — actor, action, target, changes, timestamp, request ID, metadata (existing boilerplate module).

All domain data carries `organizationId`, and every query is scoped to the organization. Details are in [`DATA_MODEL.md`](DATA_MODEL.md).

## 11. Non-functional requirements

### 11.1 Security and privacy

- All attendance and administration endpoints require authentication and server-side permission checks.
- Passwords use strong hashing; tokens and secrets are never logged.
- Production session cookies use `HttpOnly`, `Secure`, and an appropriate `SameSite`.
- CSRF protection, rate limiting, input validation, and mass-assignment prevention on relevant endpoints.
- Audit log is append-only for application users.
- Exports are restricted to authorized roles and audited.

### 11.2 Reliability and integrity

- Check-in, check-out, and correction approval are transactional.
- Database constraints guarantee uniqueness per employee and work date.
- Server time is the only time source.
- Initial capacity target: up to 1,000 active employees, burst of 100 requests/second for five minutes around check-in/out times.

### 11.3 Performance

- p95 check-in/check-out under 1 second under normal load (excluding user network latency).
- p95 daily dashboard under 2 seconds.
- Lists are paginated.

### 11.4 Usability and accessibility

- Responsive for desktop, tablet, and mobile browsers.
- Check-in/check-out actions have clear loading, success, and error states and prevent double submit.
- Main flows are keyboard accessible.
- Dates and times are displayed consistently in the organization timezone.

### 11.5 Observability

- Every request has a request/correlation ID (existing boilerplate behavior).
- Application errors, job failures, and transaction anomalies are logged without leaking sensitive data.
- Health checks reuse the boilerplate's existing endpoints.

### 11.6 Retention

- Attendance, corrections, and audit data are retained for five years by default. Retention is configurable and must be reviewed by legal before production.

## 12. Technical implementation guidelines

### 12.1 Backend (`backend-boilerplate`)

Existing stack: NestJS, Prisma, PostgreSQL, Redis/BullMQ, JWT with rotating refresh tokens, OpenAPI generation, Vitest e2e.

Before adding any module:

1. Inspect existing models and relationships.
2. Review the established controller → service → repository pattern.
3. Identify reusable utilities, validators, middleware, and guards.
4. Check existing authentication and permission implementations.
5. Review migration and database conventions.
6. Decide whether the feature extends an existing module or needs a new one.

Requirements:

- Reuse Prisma; follow existing API route, request, and response conventions.
- Reuse centralized validation and error handling.
- Use transactions where necessary and enforce integrity in the database.
- Maintain auditability for sensitive changes using the existing audit module.
- Regenerate `openapi.json` after contract changes.
- Do not introduce alternative frameworks, auth systems, ORMs, or architectural patterns without a justified requirement.

### 12.2 Frontend (`frontend-boilerplate`)

Existing stack: Next.js App Router, React, TypeScript, Tailwind, shadcn/ui, Server Components, Server Actions, typed API client generated from OpenAPI, Vitest.

Before implementing pages:

1. Inspect existing layouts and routing.
2. Review the component library and identify reusable components.
3. Review existing API clients and data-fetching patterns.
4. Review authentication and authorization handling.
5. Review styling, themes, and design tokens.
6. Identify existing dashboard components.

Requirements:

- Extend the existing app shell, layouts, and navigation.
- Reuse existing forms, tables, cards, and dialogs.
- Follow established state-management and URL-parameter patterns.
- Reuse existing API integration utilities and regenerate types from OpenAPI.
- Keep loading and error handling consistent.
- Apply Hadir.in branding through the existing theme system.
- Do not introduce redundant component libraries.

The final interface should feel like a natural extension of the frontend boilerplate.

### 12.3 Infrastructure

| Environment | Decision                                                  |
| ----------- | --------------------------------------------------------- |
| Local       | Required.                                                 |
| Staging     | Use only if already available.                            |
| Production  | Not required for the initial implementation.              |
| Platform    | Follow the boilerplate's existing infrastructure.         |

Reuse existing Dockerfiles, Docker Compose configuration, environment management, and database services. Do not replace working infrastructure.

## 13. Future scope

Not approved for the current implementation. Each item requires a separate decision before work starts.

- Per-division/per-employee schedules, shifts (including cross-midnight), and flexible hours.
- Leave, sick, and time-off requests with supporting documents; multi-level approval.
- Early check-out rules.
- Notifications (missing check-in/out, pending approvals) via email, Slack, or Teams.
- SSO (Google/Microsoft), HRIS/payroll integration, public API and webhooks, scheduled reports.
- Geolocation, selfies, device registration — only after a privacy impact assessment and legal review.

Geolocation and selfies are planned in [`ATTENDANCE_VERIFICATION_PLAN.md`](ATTENDANCE_VERIFICATION_PLAN.md), assessed in [`ATTENDANCE_VERIFICATION_PIA.md`](ATTENDANCE_VERIFICATION_PIA.md), and decided in decision 26. Legal review is still pending.
- Anomaly detection, advanced analytics, PWA or native mobile apps.

## 14. Development workflow

| #   | Topic                       | Decision                                                                                                                                                            |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20  | Product documentation       | Frontend and backend are separate repositories, so product documentation lives in the workspace root as its own Git repository (the two app repos are ignored by it). No monorepo is introduced. |
| 21  | AI repository access        | AI may modify both repositories, following each repository's architecture and conventions.                                                                          |
| 22  | Git authorization           | AI may edit, test, and create local commits on a branch (never directly on `main`). No push, merge, pull request, or deployment without explicit approval. Commits and PRs never credit Claude/Anthropic or another AI tool as co-author; commitlint rule `no-ai-co-author` enforces this in both app repos. |
| 23  | Implementation start        | Phase 01 (backend divisions and employees), conditional on the Phase 0 assessment confirming what already exists.                                                    |
| 24  | Environments                | Local required; staging if available; production not required.                                                                                                      |
| 25  | Notifications (Phase 6)     | Approved 1 November 2026, with the recommendations in `NOTIFICATIONS_PLAN.md` §8: pilot types are correction emails and the check-in/check-out reminders (N1); reminders at 09:00 and 18:00 (N2); a new correction goes to the direct manager, Admin/HR only when there is none (N3); outcome emails can't be turned off until the in-app centre exists (N4); no absence or lateness alerts to managers (N5); notifications kept 90 days (N6); Slack or Teams decided after 6C (N7). Rules: `DOMAIN_RULES.md` §18. |
| 26  | Attendance verification (Phase 7) | Product decisions final 2 November 2026, in `ATTENDANCE_VERIFICATION_PLAN.md` §8 (V1–V12). Rollout order: standard attendance and audit logging; approved-area location at check-in only if necessary; check-in selfies only if location and existing controls don't address the risk. Each method is configured per organization and off by default. Neither may be enabled in production without legal approval. Never blocks attendance. No tracking or biometric matching. |

### 14.1 Named owners

| Role                    | Owner                                          |
| ----------------------- | ---------------------------------------------- |
| Product owner           | Developer                                      |
| HR/UAT approver         | Developer, acting as simulated HR reviewer     |
| Engineering reviewer    | Developer                                      |
| Production/DevOps owner | Not assigned                                   |

## 15. Implementation strategy

Work is organized into logical phases based on the existing codebase, feature dependencies, and verified progress — not a fixed daily schedule. Existing functionality is reused and verified rather than reimplemented. The detailed, trackable plan lives in [`PLANS.md`](PLANS.md).

### Phase 0 — Boilerplate assessment

- Inspect both repositories; identify stack, architecture, implemented features, reusable modules, schemas, and migrations.
- Establish a test baseline by running existing tests.
- Produce a gap analysis.

**Phase 0 deliverables (before writing code):**

1. Backend assessment — stack, architecture, modules, authentication, database, reusable functionality.
2. Frontend assessment — stack, routing, layouts, component library, state management, API integration patterns.
3. Feature gap analysis — implemented, partially implemented, missing.
4. Implementation plan — phases and dependencies based on the actual codebase.
5. Proposed changes — files, modules, migrations, and API endpoints to add or modify.
6. Compatibility and risk assessment — breaking changes, migration risks, integration concerns.

No major refactoring or architectural change starts before the assessment is complete.

### Phase 1 — Foundation and employee management

- Extend existing user models; add divisions, employees, roles, and reporting relationships.
- Add migrations only where necessary.

### Phase 2 — Attendance core

- Attendance and schedule data models, check-in/check-out, policies, status calculation, holidays, close-day job.
- Validation and automated tests.

### Phase 3 — Corrections and approvals

- Correction requests, Manager and HR approval, audit logging, concurrency, and authorization.

### Phase 4 — Frontend integration

- Dashboards, attendance pages, correction interfaces, employee/division management, configuration pages, reports.
- API integration and Hadir.in branding.

### Phase 5 — Verification and documentation

- Run automated tests; verify frontend/backend integration, permissions, and business rules.
- Fix defects; update documentation; verify local setup and demo workflows.

## 16. Testing and quality assurance

Follow each repository's existing testing framework. Run existing tests before changes to establish a baseline, and run relevant unit, integration, and frontend tests after. No breaking changes to existing functionality.

Critical scenarios:

- Authentication and authorization; role-based data access.
- Employee and division management.
- Successful check-in and check-out; duplicate prevention under concurrency.
- Late calculation, including the exact tolerance boundary.
- Check-in window and check-out deadline restrictions.
- Weekend and holiday validation.
- Missing check-out handling and close-day absence marking.
- Correction submission, approval, and rejection.
- Self-approval prevention and concurrent approval protection.
- Timezone and date-boundary calculations (device in another timezone, UTC midnight vs Jakarta midnight).

## 17. Documentation requirements

Existing documentation is updated rather than replaced. Documentation must reflect the implemented architecture and cover:

- Project overview and application architecture.
- Local setup and environment configuration.
- Database migration and seed instructions.
- API documentation (OpenAPI).
- Role and permission matrix.
- Attendance business rules.
- Testing instructions.
- Demo accounts.
- Known limitations.

## 18. Mandatory AI development rules

1. Do not rebuild the project from scratch.
2. Do not replace the existing technology stack.
3. Do not introduce a new architecture unnecessarily.
4. Do not recreate features already implemented in the boilerplate.
5. Do not duplicate existing authentication, authorization, database, or UI infrastructure.
6. Do not restructure repositories without a clear technical reason.
7. Inspect the existing implementation before modifying it.
8. Prefer extending existing modules over parallel implementations.
9. Follow existing naming conventions and coding standards.
10. Preserve backward compatibility wherever practical.
11. Implement features according to actual dependencies.
12. Run tests before and after relevant changes.
13. Keep local commits clean and reviewable.
14. Do not push or deploy without authorization.
15. Keep documentation synchronized with the implementation.
16. Do not reduce required functionality to meet an arbitrary time estimate.
17. Do not add complexity or features outside the approved requirements.
18. Prioritize correctness, maintainability, security, and integration quality.
19. Never add AI co-author trailers (`Co-Authored-By: Claude …`) or "Generated with Claude Code" lines to commits or PRs.

## 19. Risks and mitigations

| Risk                                     | Impact                                  | Mitigation                                                                  |
| ---------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| Wrong time or timezone handling          | Wrong late status and work dates        | Server time only; store UTC; derive work date in `Asia/Jakarta`; boundary tests. |
| Duplicate requests or race conditions    | Duplicate attendance                    | Transactions, idempotency, and unique constraints.                          |
| Forgotten check-outs                     | Many incomplete records                 | Dashboard indicators and the official correction flow.                      |
| Retroactive policy changes               | Historical reports change               | Effective-dated schedules and schedule snapshots on attendance.             |
| Overly broad data access                 | Privacy violation                       | Backend permissions, team scoping, audit, and negative tests.               |
| Concurrent correction decisions          | Double application of a correction      | Conditional update on `PENDING` status inside a transaction.                |
| Rebuilding instead of extending          | Lost boilerplate quality, inconsistency | Phase 0 assessment and the mandatory AI rules.                              |

## 20. Definition of done per feature

- Requirements and acceptance criteria are met and demonstrable.
- UI covers empty, loading, and error states where relevant.
- Validation, authorization, business rules, and audit are enforced on the server.
- Migrations apply cleanly on an existing and an empty database.
- Unit, integration, and end-to-end tests for critical flows pass.
- Negative tests for role access and input manipulation pass.
- OpenAPI and frontend generated types are in sync.
- Documentation is updated.
- No open critical or high-severity defects.
- The product owner (simulated HR reviewer) accepts the UAT result.

## 21. Related documents

- [`DOMAIN_RULES.md`](DOMAIN_RULES.md) — normative formulas, boundaries, invariants, and error codes.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — components, modules, runtime flows, reliability.
- [`DATA_MODEL.md`](DATA_MODEL.md) — entities, constraints, indexes, retention, migrations.
- [`UX_FLOWS.md`](UX_FLOWS.md) — routes, screen states, copy intent, accessibility.
- [`PLANS.md`](PLANS.md) — phased implementation plan and evidence.

## 22. Change log

| Version | Date            | Changes |
| ------- | --------------- | ------- |
| 0.2     | 30 October 2026 | Indonesian-language baseline organized into Waves 1–6 with time estimates. |
| 0.3     | 30 October 2026 | Renamed to Hadir.in; document and UI language set to English. Manager role, corrections, holidays, dashboards, and reporting moved into baseline scope (previously Waves 2–3). Waves replaced by dependency-based Phases 0–5; Waves 4–6 moved to Future scope. Added branding, naming, pilot, development workflow, owners, technical guidelines, and mandatory AI rules. Status codes changed to English (`PRESENT`, `LATE`, `ABSENT`, `EXCUSED`; corrections `PENDING`/`APPROVED`/`REJECTED`). Removed the HR override for self-approval and late correction submissions. Owners changed to Developer. Local commits are now allowed. |
