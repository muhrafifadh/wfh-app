# UX Flows — Hadir.in

| Attribute | Value                                     |
| --------- | ----------------------------------------- |
| Status    | UX baseline for the full baseline scope   |
| Version   | 0.2                                       |
| Date      | 30 October 2026                           |
| Platform  | Responsive web (desktop, tablet, mobile)  |
| Language  | English                                   |

## 1. UX goals

- Employees understand today's status and check in/out without training.
- The main action completes in under 30 seconds under normal conditions.
- Official time, timezone, schedule, and action results are always clearly visible.
- Managers see their team's day and clear pending corrections quickly.
- Admin/HR completes setup without editing the database.
- Empty, loading, error, and access-denied states are designed as carefully as the happy path.
- The UI never implies productivity, location, or device tracking, because none is done.
- The interface feels like a natural extension of the frontend boilerplate, with Hadir.in branding.

## 2. Interaction principles

1. **One primary action per state.** Before check-in, focus on Check in; afterwards, on Check out.
2. **Status over decoration.** Use text labels and icons, never color alone.
3. **Transparent official time.** Show "Organization time (WIB)" and explain that server time is used.
4. **No optimistic success for attendance.** Success appears only after the backend confirms.
5. **Prevent double submit.** Buttons go into a pending state, and every intent uses an idempotency key.
6. **Actionable errors.** State the cause and next step, plus a request ID for unexpected errors.
7. **Mobile-first for employees.** Attendance actions are comfortable on narrow viewports.
8. **Admin tables still work on mobile.** Use card/list fallbacks or clear horizontal scrolling.
9. **Shareable filters.** List and report filters live in the URL.
10. **Consistent language.** All user-facing copy is English; technical codes are hidden except the request ID.

## 3. Global information

### 3.1 App shell

The existing sidebar/header shell is extended to show:

- The "Hadir.in" text wordmark.
- Navigation filtered by permission.
- User name and display role.
- Organization timezone where relevant.
- Profile and display settings menu.
- Support contact (configurable) in the help/profile menu.
- Log out.

### 3.2 Branding

- Primary `#A50034` for primary buttons, links, and active navigation.
- Secondary `#D50032` and accent `#B22234` sparingly (secondary buttons, emphasis, charts).
- Soft background `#F7C6C7` for subtle highlights (selected rows, info banners, active nav background).
- White `#FFFFFF` page background.
- Status badges use semantic colors with text and an icon: Present, Late, Absent, Incomplete, Pending, Approved, Rejected. Late and Absent must remain distinguishable from the brand red (e.g. amber for Late, neutral/dark for Absent with an icon).
- Applied via existing theme tokens; dark mode, if the boilerplate supports it, keeps working.

### 3.3 Navigation by role

| Menu                 | Employee | Manager             | Admin/HR                  |
| -------------------- | :------: | :-----------------: | :-----------------------: |
| Dashboard            |   Yes    | Yes (team view)     | Yes (organization view)   |
| Today's Attendance   |   Yes    | With profile        | With profile              |
| My History           |   Yes    | With profile        | With profile              |
| My Corrections       |   Yes    | With profile        | With profile              |
| Team                 |    No    | Yes                 | No (uses Reports)         |
| Correction Review    |    No    | Yes                 | Yes                       |
| Reports              |    No    | Team scope          | Yes                       |
| Employees            |    No    | No                  | Yes                       |
| Divisions            |    No    | No                  | Yes                       |
| Holidays             |    No    | No                  | Yes                       |
| Attendance Settings  |    No    | No                  | Yes                       |
| Users                |    No    | No                  | Yes (existing page)       |
| Audit Log            |    No    | No                  | Yes (existing page)       |
| My Profile           |   Yes    | Yes                 | Yes                       |

Menu items the user cannot access are hidden, but the backend remains the access control.

### 3.4 Formats

- Dates: `Friday, 30 October 2026` for primary context; `30 Oct 2026` in tables.
- Times: `09:15:00 WIB` for transactions/status; seconds may be hidden in tables.
- Detail timestamps may show UTC in a tooltip for audit.
- Duration: `7h 42m`; CSV uses integer minutes.
- Empty value: `—`, never `0` or an empty string.

## 4. Route map

```text
/login                              existing
/dashboard                          existing route, role-aware content
/attendance                         today's attendance
/attendance/history                 my history (daily list + monthly view)
/attendance/:id                     record detail
/corrections                        my corrections
/corrections/new?attendanceId=…     submit a correction
/corrections/:id                    correction detail
/corrections/review                 review queue (Manager, Admin/HR)
/team                               team attendance (Manager)
/reports                            attendance reports
/employees                          employee list
/employees/new
/employees/:id
/divisions
/holidays
/settings/attendance                schedule and policy
/profile                            my profile
/users, /audit-log                  existing
```

`/` and post-login redirect to `/dashboard`. The public register page is hidden (`REGISTRATION_ENABLED=false`); accept-invite, forgot-password, and reset-password stay.

## 5. Authentication

### 5.1 Login

```mermaid
flowchart TD
    A[Open protected page] --> B{Valid session?}
    B -- Yes --> C[Target page]
    B -- No --> D[/login?next=target]
    D --> E[Enter email and password]
    E --> F{Login succeeded?}
    F -- Yes --> C
    F -- No --> G[Show safe error]
    G --> E
```

The existing login page is reused and rebranded:

- Hadir.in wordmark and a one-line product description.
- Email and password fields with persistent labels.
- Inline validation and a screen-reader-readable summary.
- "Sign in" button with a pending state.
- Wrong credentials, unknown user, and disabled account show the same generic message.
- Rate limits show a wait time without exposing security details.
- `next` accepts only safe local paths.

### 5.2 Logout

- The user chooses "Log out" from the profile menu.
- The backend revokes the session and the frontend clears cookies (existing behavior).
- The user is redirected to login.

## 6. Dashboards — `/dashboard`

### 6.1 Employee dashboard

```text
┌───────────────────────────────────────────┐
│ Good morning, Rina                        │
│ Friday, 30 October 2026 · 08:52:14 WIB    │
├───────────────────────────────────────────┤
│ Today                                     │
│ Schedule 09:00–17:00 WIB · 15 min grace   │
│ Status: Not checked in                    │
│               [ Check in ]                │
├─────────────────────┬─────────────────────┤
│ This month          │ Corrections         │
│ Present 14 · Late 2 │ 1 pending           │
│ Absent 0 · Inc. 1   │ View →              │
├─────────────────────┴─────────────────────┤
│ Recent attendance (last 5) · View all →   │
└───────────────────────────────────────────┘
```

Contents: current date and time (server-seeded), today's status, check-in/check-out actions (same component as `/attendance`), recorded times, working duration, month summary, recent history, and correction status.

A user without an employee profile (e.g. Admin/HR only) does not see the attendance card.

### 6.2 Manager dashboard

- Everything from the employee dashboard if the manager has a profile.
- Team today: Present, Late, Not checked in, Not checked out, Absent (yesterday) — cards act as filters.
- Late and absent summary for the current week.
- Pending corrections from direct reports with Approve/Reject shortcuts to the review page.
- Direct-report list with today's status.

### 6.3 Admin/HR dashboard

- Total active employees.
- Present, late, and absent (not checked in after the window closes) today.
- Pending corrections (organization).
- Attendance trend chart (last 30 working days: present, late, absent, incomplete) using the existing Recharts setup.
- Employee and division filters.
- Shortcut to Reports for organization-wide reporting.

### 6.4 Dashboard behavior

- Counts can poll at an agreed interval, have a refresh button, and show "Last updated".
- Before close-day has run, absence for today is shown as "Not checked in", not as final Absent.
- All numbers link to the filtered list behind them.

## 7. Today's Attendance — `/attendance`

The employee's main page.

### 7.1 Layout

```text
┌──────────────────────────────────────┐
│ Today's Attendance                   │
│ Friday, 30 October 2026              │
│ Organization time: 08:52:14 WIB      │
├──────────────────────────────────────┤
│ Schedule                             │
│ 09:00–17:00 WIB · 15 min tolerance   │
├──────────────────────────────────────┤
│ Status: Not checked in               │
│                                      │
│           [ Check in ]               │
│                                      │
│ Server time is the official time.    │
├──────────────────────────────────────┤
│ Latest summary / link to history     │
└──────────────────────────────────────┘
```

The running clock is an estimate synced from `serverNow`; every refresh and mutation resyncs it. Timestamps from the API are official.

### 7.2 Page states

#### A. Loading

- Skeleton for date, schedule, status, and action card.
- No active button until eligibility is known.

#### B. Before the check-in window

- Status: "Check-in not open yet".
- "Check-in opens at 08:00 WIB."
- Button disabled; a countdown is never the only information.
- The UI refreshes state at the boundary, but the backend still validates.

#### C. Ready to check in

- Status: "Not checked in".
- Primary button "Check in", no dialog, for speed.
- After pressing: button disabled, spinner, "Recording check-in…".
- The same idempotency key is reused for retries of that intent.

#### D. Check-in succeeded

- Toast/announcement: "Checked in at 08:57 WIB."
- The card shows Present or Late, check-in time, late minutes if any, and a "Check out" button.
- Focus moves to the status heading for keyboard/screen-reader users.

#### E. Ready to check out

- Shows check-in time and status.
- "Check out" opens a confirmation dialog:
  - Title: "Finish today's attendance?"
  - Body: check-in time and a note that server time at confirmation will be recorded.
  - Actions: "Cancel" and "Yes, check out".

#### F. Check-out succeeded

- Status stays Present/Late.
- Shows check-in, check-out, and duration.
- No more transaction buttons; secondary CTA "View history".

#### G. Non-working day

- Status: "Today is not a working day".
- Reason: weekend, or the holiday name.
- No check-in/out buttons.

#### H. Check-in window closed

- Status: "Today's check-in window has closed".
- Explain that a correction can be submitted after the day closes (from tomorrow, within seven days).

#### I. Check-out deadline passed (incomplete)

- Shown on history/dashboard for previous days: "Missing check-out" with CTA "Request correction".

#### J. No or inactive employee profile

- "Your account doesn't have an active employee profile."
- No attendance actions; CTA "Contact Admin/HR" with the configured support contact. No internal identifiers.

#### K. Temporary error

- Keep the last confirmed status and show when it was last updated.
- "We couldn't load your attendance status. Try again." with a "Try again" button.
- If a transaction response is lost, refresh today's state before offering a new action.

### 7.3 Late message

- Status: "Late".
- Description: "Checked in 7 minutes after the 09:15 WIB deadline."
- Factual, non-punitive tone.
- Never recalculate in the browser; use `lateMinutes` from the API.

## 8. My History — `/attendance/history`

### 8.1 Content

- Heading and active filter summary.
- View toggle: **Daily** (list) and **Monthly** (calendar grid with status per day and a month summary).
- Date range filter (default: current month) and optional status filter (Present, Late, Absent, Incomplete).
- Summary: present, late, absent, incomplete, total worked time for the range.
- Table/cards: date, status, check-in, check-out, duration, correction indicator (Corrected / Correction pending).
- Server-side pagination, default 20.

### 8.2 Interaction

- Filters are URL params.
- Selecting a row opens the detail via a link, not a click-only container.
- On mobile, rows become cards with the same information order.
- Open records show "Not checked out" (or "Missing check-out" after the deadline), with no fake duration.
- Absent records show `—` for check-in/out.

### 8.3 Empty states

- No history: "No attendance records yet."
- Filter with no results: "No attendance matches these filters." + "Reset filters".
- Invalid date ranges are validated before the request.

### 8.4 Record detail — `/attendance/:id`

Shows:

- Work date and timezone.
- Schedule snapshot.
- Check-in/check-out.
- Status, completion, late minutes, and duration.
- Correction indicator and correction history (original vs corrected values, decider, time).
- CTA "Request correction" while within the seven-day window and no correction is pending.

## 9. Corrections

### 9.1 Submit — `/corrections/new`

Entry points: record detail, dashboard "Missing check-out", or history row action.

The form shows:

- Work date and current values (read-only).
- Proposed check-in and/or check-out time (time inputs in WIB on the work date).
- Preview of the resulting status/duration (calculated by the API or clearly labeled as a preview).
- Reason, 10–1,000 characters, with a counter.
- Submission deadline ("You can request a correction until Friday, 6 November 2026").

Confirmation states that attendance does not change until the request is approved.

### 9.2 My corrections — `/corrections`

- Tabs/filter: Pending, Approved, Rejected.
- Each item: work date, proposed changes, submitted time, status, decider and decision note when decided.

### 9.3 Review queue — `/corrections/review`

- Managers see only direct reports; Admin/HR sees the organization (filter by division/employee).
- Default sort: oldest pending first.
- The reviewer's own requests never appear here.

### 9.4 Review — `/corrections/:id`

Comparison layout:

| Field     | Current | Proposed |
| --------- | ------- | -------- |
| Check-in  | 09:42   | 08:58    |
| Check-out | —       | 17:10    |
| Status    | Late    | Present  |
| Duration  | —       | 8h 12m   |

- The requester's reason is shown in full.
- Approve and Reject are separate actions; Reject requires a note.
- The first decision is final. If another reviewer already decided, refresh and show who decided and when, without applying the second action.
- No decision buttons on the reviewer's own request.

## 10. Team — `/team` (Manager)

- Work date selector, default today.
- Cards: Present, Late, Not checked in, Not checked out, Absent — usable as filters, always labeled.
- List: name, number, schedule, check-in, check-out, status, completion, correction indicator.
- History for each direct report for the last 90 days via the employee row.

## 11. Reports — `/reports`

### 11.1 Filters

- Required date range (maximum range set at implementation, e.g. 366 days).
- Employee, division (Admin/HR), status, completion.

### 11.2 Results

- Summary cards for the filter.
- Trend chart (daily counts).
- Detail table that reconciles with the summary.
- Correction indicator.
- Pagination.
- "Export CSV" (Should) exports the full filtered result, not just the current page. Export is audited.

## 12. Employees — `/employees`

### 12.1 List

- Search by name, email, or employee number.
- Filters: division, status, manager.
- Columns: number, name, account state, division, manager, role, status, actions.
- URL keeps q/filter/sort/page.
- Primary action: "Add employee".

### 12.2 Add employee

Minimum fields:

- Employee number (e.g. `EMP-011`).
- Full name.
- Work email (account to link or invite).
- Division.
- Direct manager (optional).
- Employment start date.
- Account role (Employee, Manager, Admin/HR).

Behavior:

- Number is normalized to uppercase on blur/submit and validated against the pattern.
- Explain when the email will receive an invitation (existing invite flow).
- Submit disabled while pending.
- Number/email conflicts map to the right field.
- On success, go to the detail page with a success message.

### 12.3 Detail/edit

- Separate employment information from account status.
- Short audit metadata: created/updated.
- Changing division, manager, or role asks for confirmation when it affects access.
- Deactivate uses a dialog explaining the effective date and that history is kept.
- Reactivate is available for inactive employees.
- No hard delete in the UI.

### 12.4 Special states

- Invitation pending.
- User active but employee inactive.
- Employee not linked to a user.
- Employment end date passed.

These are never merged into one ambiguous "Inactive" label.

## 13. Divisions — `/divisions`

- List code, name, status, and active employee count.
- Create/edit through a dialog or page reachable by keyboard.
- Code normalized to uppercase.
- Deactivating a division with active employees is rejected, or the UI offers to move them first.
- Empty state: "No divisions yet" with a create CTA.
- No hard delete for divisions that have been used.

## 14. Holidays — `/holidays`

- List (and optional calendar) per year.
- Create/edit name and date; delete is a soft delete with confirmation.
- Date conflicts shown inline.
- Adding a holiday on a past date with existing records shows a warning; records are never deleted silently.

## 15. Attendance Settings — `/settings/attendance`

### 15.1 Form

- Timezone: `Asia/Jakarta`.
- Working days: Monday–Friday.
- Start time 09:00, end time 17:00.
- Late tolerance: 15 minutes.
- Check-in window: 08:00–17:00.
- Check-out deadline: 23:59.
- Effective date.
- Support contact and data retention (years) as organization settings.

### 15.2 Guardrails

- The effective date is no earlier than tomorrow in the organization timezone.
- Preview shows: check-in opens, on-time deadline, check-in closes, check-out closes.
- Changes create a new version; the UI never offers "apply to history".
- Confirmation summarizes old values, new values, and the effective date.
- After success, show the active schedule and the upcoming one if any.
- The UI warns about period conflicts before submit; the backend still validates.

## 16. My Profile — `/profile`

- Read-only employee profile: name, employee number, division, manager, role, employment start date, work email.
- Existing account settings (password change, sessions) if the boilerplate provides them.

## 17. Error mapping

| Domain condition               | User message                                                   | Next step                         |
| ------------------------------ | -------------------------------------------------------------- | --------------------------------- |
| `CHECK_IN_TOO_EARLY`           | "Check-in opens at 08:00 WIB."                                 | Wait / auto refresh.              |
| `ATTENDANCE_NOT_WORKDAY`       | "Today is not a working day."                                  | None.                             |
| `ATTENDANCE_ALREADY_CHECKED_IN`| "Your check-in is already recorded."                           | Refresh today's status.           |
| `ATTENDANCE_NOT_CHECKED_IN`    | "You need to check in before checking out."                    | Back to today's status.           |
| `ATTENDANCE_ALREADY_CHECKED_OUT`| "Your check-out is already recorded."                         | Refresh today's status.           |
| `CHECK_IN_WINDOW_CLOSED`       | "Today's check-in window has closed."                          | Request a correction later.       |
| `CHECK_OUT_WINDOW_CLOSED`      | "The check-out deadline has passed."                           | Request a correction.             |
| `EMPLOYEE_INACTIVE`            | "Your employee profile is inactive."                           | Contact Admin/HR.                 |
| `CORRECTION_WINDOW_CLOSED`     | "Corrections can only be requested within 7 days."             | Contact Admin/HR.                 |
| `CORRECTION_ALREADY_PENDING`   | "A correction for this day is already pending."                | Open the pending request.         |
| `CORRECTION_ALREADY_DECIDED`   | "This request was already decided by {name} at {time}."        | Refresh.                          |
| `CORRECTION_SELF_APPROVAL_FORBIDDEN` | "You can't decide your own request."                     | None.                             |
| `CORRECTION_VERSION_CONFLICT`  | "This attendance record changed after the request was made."   | Requester submits a new request.  |
| Session expired                | "Your session has ended. Please sign in again."                | Login with a safe next path.      |
| Forbidden / not found          | "You don't have access to this page."                          | Back to an allowed page.          |
| Network/server                 | "Something went wrong. Try again." + request ID if available   | Safe retry / refresh state.       |

Messages are never built from raw error strings. The frontend maps stable API error codes to approved copy.

## 18. Loading, pending, and refresh

- Page-level loading uses skeletons that match the final layout (existing `loading.tsx` pattern).
- Pending buttons keep their size to avoid layout shift.
- All mutations block resubmission until the result is known.
- If the connection drops after a mutation is sent, the UI checks the latest state before creating a new intent.
- Polling pauses when the tab is hidden and refreshes on return.
- "Today" data is never cached past the organization date change.

## 19. Responsive behavior

### Mobile

- The primary attendance action is within comfortable reach and at least 44×44 CSS px.
- Status/schedule appear before secondary navigation.
- History tables become cards or keep readable priority columns.
- Dialogs fit the viewport and scroll.

### Tablet

- Two-column dashboard cards; sidebar collapses to the existing mobile/drawer pattern.

### Desktop

- The attendance card has a max width to keep focus.
- Admin tables use space for filters; no bulk mutations are required.

## 20. Accessibility

- One clear `h1` per page.
- Form labels are bound to inputs; placeholders are not labels.
- All actions are keyboard accessible, and focus order follows visual order.
- Dialogs trap focus and return it to the trigger.
- Mutation results are announced through an appropriate live region.
- Contrast meets WCAG 2.1 AA, including brand colors on white and white on `#A50034`.
- Icons have accessible names or are hidden when decorative.
- Status is never distinguished by color alone.
- Field errors and the error summary are linked.

## 21. Privacy and trust copy

On an info/help page, briefly explain:

- Hadir.in uses server time.
- No location, photos, or device activity are collected.
- Duration is the time between check-in and check-out, not a productivity measure.
- Corrections are recorded for audit.

Never request geolocation, camera, or device fingerprint permissions. The one planned exception: once legal has approved it and an organization has enabled it (PRD decision 26), location and camera may be requested at check-in, after the employee has seen the notice in `ATTENDANCE_VERIFICATION_PIA.md` §9. That organization's copy above is rewritten to match at the same time. Device fingerprinting stays prohibited.

## 22. UX acceptance criteria

- A new user can find and complete check-in without external instructions.
- Organization time, schedule, status, and the main action are visible on a common mobile viewport.
- Before-window, ready, open, complete, non-working day, holiday, window closed, inactive, and error states have explicit designs.
- Double-clicks never create two active intents or two records.
- After an ambiguous response, the UI checks state before offering a new retry.
- Every page has relevant loading, empty, error, and unauthorized handling.
- History, team, report, and admin filters live in the URL.
- Employees never see another employee's data through navigation, responses, or error details.
- Managers see only direct reports.
- Main flows pass keyboard testing, a screen-reader smoke test, and an automated accessibility check.
- Status copy and time calculations match `DOMAIN_RULES.md`.

## 23. Pilot usability check

The pilot is the Engineering division (10 demonstration employees, five working days). The developer, acting as the simulated HR reviewer, walks through:

1. Log in from a protected-page link.
2. Find the schedule and on-time deadline.
3. Check in (on time and late cases).
4. Explain the displayed status.
5. Check out.
6. Find attendance from three days ago in daily and monthly views.
7. Submit a correction for a missing check-out.
8. As the Engineering Manager, approve one correction and reject another.
9. As Admin/HR, add an employee, add a holiday, and change the schedule effective tomorrow.
10. As Admin/HR, review the dashboard and a report for the pilot week.

Record task completion, errors, and confusing terms, and fix recurring problems before sign-off.
