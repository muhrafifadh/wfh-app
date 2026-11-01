# Notifications Plan

| Attribute     | Value                                                         |
| ------------- | ------------------------------------------------------------- |
| Status        | Approved 1 November 2026 (PRD decision #25); 6A in progress   |
| Version       | 0.1                                                           |
| Date          | 1 November 2026                                               |
| Product owner | Developer                                                     |
| Roadmap       | [`PLANS.md`](PLANS.md) Phase 6 (6A–6D)                        |

## 1. Goal

Tell people about the attendance actions they would otherwise miss, without nagging:

- Employees forget to check in or out, and only find out when the record shows Absent or Missing check-out.
- Managers and Admin/HR don't know a correction is waiting unless they open the review queue.
- Employees don't know their correction was decided unless they look.

PRD §13 lists "notifications (missing check-in/out, pending approvals) via email, Slack, or Teams" as future scope needing its own decision. This plan is the input to that decision.

## 2. What exists already

- **Email:** `MailService` (`backend/src/infra/mail`) with an SMTP transport and a console transport for development; plain-text messages.
- **Background jobs:** BullMQ queues with retries and backoff (`backend/src/infra/queue`), the `user-emails` queue as a pattern, and the close-day job scheduler that runs at a set time in the organization's zone.
- **Domain events:** services emit `<entity>.<past-tense-verb>` events (`correction.submitted`, `correction.approved`, …) that the audit log already listens to.
- **Server time and the fixed clock** for e2e tests, and the organization zone (`Asia/Jakarta`).

Notifications are listeners and scheduled jobs on top of these; no new infrastructure is needed for email.

## 3. Notification types

| Type                          | Recipient            | When                                                                                     | Channel (first) |
| ----------------------------- | -------------------- | ---------------------------------------------------------------------------------------- | --------------- |
| `correction.submitted`        | Reviewers            | A correction is submitted. Reviewers: the direct manager; Admin/HR only if there's none (decision N3). | Email, in-app   |
| `correction.decided`          | Requester            | Their correction is approved or rejected, with the decision note.                        | Email, in-app   |
| `reminder.check_in`           | Employee             | A working day, the employee is active, hasn't checked in, and it's the reminder time (default 09:00, before the 09:15 on-time deadline). | Email, in-app   |
| `reminder.check_out`          | Employee             | They checked in, haven't checked out, and it's the reminder time (default 18:00; optionally again at 21:00), before the 23:59:59 deadline. | Email, in-app   |
| `reminder.correction_window`  | Employee             | A record is Absent or Missing check-out, has no pending correction, and the correction window ends tomorrow (day 7). | Email, in-app   |
| `digest.pending_corrections`  | Managers, Admin/HR   | Weekday morning summary of corrections still waiting, if any.                            | Email           |

Not included: absence or lateness alerts to managers (risks feeling like surveillance; decision N5), schedule and holiday announcements (later), anything outside attendance.

## 4. Rules

These go into `DOMAIN_RULES.md` as a new section when approved.

1. **Server decides, in organization time.** Reminder times are organization-time wall-clock times; jobs run on the server's clock in the organization's zone, like close-day.
2. **Only when it's actionable.** A check-in reminder is sent only if the check-in window is still open at send time; a check-out reminder only before the check-out deadline; never on weekends, holidays or non-working days; never to inactive employees or users without an employee profile.
3. **Re-check at send time.** The job re-reads attendance just before sending: if the employee checked in a minute ago, nothing is sent.
4. **At most once.** Every notification has a deduplication key, for example `reminder.check_in:{employeeId}:{workDate}`, unique in the database. Retries and re-runs never send twice.
5. **Never blocks the action.** Sending happens after the transaction commits (outbox or post-commit listener); a mail failure never fails a correction or check-in.
6. **Minimal content.** Messages say what happened and link to the page; no reason text from other people beyond the decision note the requester is entitled to see, no other employees' data, no tokens in links.
7. **Respect preferences.** Reminders and digests can be turned off per user and per type; correction outcomes cannot be turned off for email until in-app exists (decision N4).

## 5. Phases

### Phase 6A — Correction notifications by email

- **Backend:** a `notifications` module that listens to `correction.submitted` and `correction.approved`/`rejected`, resolves recipients with the existing scoping (direct manager, Admin/HR fallback), writes a `Notification` row with its deduplication key, and enqueues an email job.
- **Data model:** `Notification` (organization, recipient user, type, deduplication key unique, small JSON payload, created at, sent at, failed at, failure code, read at).
- **Email:** text templates per type with a link to `/corrections/:id`; sender and app URL from config (`FRONTEND_URL`).
- **Acceptance:** submitting a correction emails the direct manager once; deciding it emails the requester once; re-running the job or retrying after a mail failure sends nothing extra; a reviewer outside the scope gets nothing; mail failure leaves the correction intact and the notification marked failed with a code.

### Phase 6B — Reminders

- **Backend:** job schedulers per organization for the reminder times; each run selects eligible employees (rules 2–3) in batches and creates notifications with deduplication keys. Re-uses the close-day pattern for "which day is it in Jakarta".
- **Settings:** organization notification settings (each reminder on/off, times, the optional second check-out reminder) managed by Admin/HR (`policy:manage`), with audit.
- **Acceptance (fixed clock e2e):** a reminder at 09:00 goes to active employees who haven't checked in on a working day; none on a holiday or weekend, none to someone who checked in at 08:59:59, none after the check-in window closes; a second run on the same day sends nothing; the check-out reminder stops once the employee checks out; times follow Jakarta at a UTC date boundary.

### Phase 6C — In-app notification centre and preferences

- **Frontend:** a bell in the header with an unread count, a list (newest first, paginated), mark as read and mark all as read; each item links to its page. A "Notifications" section in My profile for per-type preferences; an Admin/HR settings page for the reminder times.
- **Backend:** `GET /v1/notifications/me`, `POST /v1/notifications/{id}/read`, `POST /v1/notifications/me/read-all`, preference endpoints; strict scoping (only your own; 404 otherwise). OpenAPI and frontend types regenerated, with `contract.ts` checks.
- **Data model:** `NotificationPreference` (user, type, channel, enabled).
- **Acceptance:** the unread count matches the list; marking read is idempotent; another user's notification is 404; preferences stop reminder emails but not in-app items (unless turned off too); keyboard and screen-reader friendly (the count is announced, not colour-only).

### Phase 6D — Slack or Microsoft Teams (gated)

- Only after a separate decision on which tool, workspace-level or per-user delivery, and what may leave Hadir.in (PRD §13 lists integrations separately). Likely an incoming webhook per organization for manager digests only.
- Not planned in detail until that decision.

## 6. Changes by layer (summary)

| Layer          | Change                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Domain rules   | New "Notifications" section: types, eligibility, timing, deduplication, content limits.              |
| Data model     | `Notification`, `NotificationPreference`, organization notification settings; indexes on recipient and created date. |
| Backend        | `notifications` module: event listeners, reminder schedulers, email jobs, API for 6C; audit for settings changes. |
| Frontend       | Bell and list (6C), profile preferences (6C), Admin/HR settings page (6B).                           |
| Config         | Sender address and reminder defaults in `env.ts` / `.env.example`; SMTP already configurable.        |
| Retention      | Notifications kept 90 days, then deleted by a cleanup job (decision N6).                             |
| UX copy        | Short English messages; privacy page says what notifications are sent and how to turn them off.      |

## 7. Risks

| Risk                                    | Mitigation                                                              |
| --------------------------------------- | ----------------------------------------------------------------------- |
| Duplicate or late reminders             | Deduplication keys, re-check at send time, send windows tied to the rules. |
| Reminders feel like pressure            | Few types, one per day each, easy opt-out, no manager alerts by default. |
| Email deliverability at 1,000 employees | Batched jobs with rate limits; provider SMTP in production; failures logged with codes. |
| Wrong day or time                       | Organization-zone scheduling and fixed-clock tests at boundaries.       |
| Data leaking through email              | Minimal content, links instead of details, no tokens.                   |

## 8. Decisions needed

| #   | Decision                                                     | Recommendation                                              |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| N1  | Which types are in scope for the pilot?                      | 6A (corrections) and the check-in and check-out reminders.  |
| N2  | Default reminder times                                       | Check-in 09:00; check-out 18:00 (no second one by default). |
| N3  | Who is notified of a new correction?                         | The direct manager; Admin/HR only when there is none.       |
| N4  | Can employees turn off correction outcome emails?            | Not until the in-app centre (6C) exists.                    |
| N5  | Should managers be alerted about absences or lateness?       | No; they use the dashboard.                                 |
| N6  | How long are notifications kept?                             | 90 days.                                                    |
| N7  | Slack or Teams?                                              | Decide after 6C, based on what the pilot organization uses. |

## 9. Recommended order

6A → 6B → 6C, each with its own approval gate as in `PLANS.md`. 6D only after its own decision. Notifications go before attendance verification ([`ATTENDANCE_VERIFICATION_PLAN.md`](ATTENDANCE_VERIFICATION_PLAN.md)) because they carry little privacy risk and build the scheduling and settings patterns that phase reuses.
