# Hadir.in

Hadir.in is a web-based attendance system for people who work from home. It replaces attendance tracked through chat, spreadsheets and ad-hoc forms with one consistent record, based on server time, that managers and HR can monitor, correct through a formal process, and report on.

**Live site:** [hadir-in.armerta.biz.id](https://hadir-in.armerta.biz.id)

## Who it's for

| Role         | What they do in Hadir.in                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Employee** | Check in and out, see today's status and their history, and request a correction when something is wrong          |
| **Manager**  | See who on their team has checked in or out, review team reports, and decide their direct reports' corrections    |
| **Admin/HR** | Manage employees, divisions, schedules and holidays, monitor the organization, decide corrections, export reports |

## What it does

- **Daily attendance:** check-in and check-out use server time, so a device's clock can't affect the record. Each employee has at most one record per work date, and retries and double clicks don't create duplicates.
- **Schedules and holidays:** the schedule is set for the whole organization and versioned. Each record keeps the schedule it was judged by, so later changes don't rewrite history. Check-ins on weekends and holidays are rejected.
- **Absence:** a nightly job marks eligible employees without a record as absent.
- **Corrections:** employees can request a change for up to seven days after the work date. Their direct manager or Admin/HR decides, the first decision is final, and nobody can decide their own request.
- **Dashboards and reports:** team and organization views, attendance trends and CSV export.
- **Notifications:** emails about corrections, check-in and check-out reminders, a notification centre in the app, and per-user email preferences.
- **Audit log:** changes to attendance through corrections, and administrative changes, can be traced.

The default policy is Monday to Friday, 09:00–17:00 in `Asia/Jakarta`, with 15 minutes of late tolerance.

Hadir.in deliberately doesn't calculate payroll or track activity, screens or productivity. It also has no location checks, selfies or biometrics today; those are planned only behind a privacy and legal review.

## How it's built

| Part                     | Technology                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| [`backend/`](backend/)   | NestJS 12, TypeScript, PostgreSQL 17 with Prisma 7, Redis with BullMQ for background jobs |
| [`frontend/`](frontend/) | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query               |
| [`docs/`](docs/)         | Product and design documents                                                              |

The web app talks to the API, and the API enforces all attendance rules and permissions. Timestamps are stored in UTC, while work dates and statuses are calculated in the organization's time zone. Each app's README covers its setup and structure.
