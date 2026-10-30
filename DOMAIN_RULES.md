# Domain Rules — Hadir.in

| Attribute       | Value                                             |
| --------------- | ------------------------------------------------- |
| Status          | Normative baseline                                |
| Version         | 0.2                                               |
| Date            | 30 October 2026                                   |
| Decision source | `PRODUCT_REQUIREMENTS.md` §5, §6, and §9          |

## 1. Purpose and usage

This document is the source of truth for attendance calculations and validation. If a UI example or implementation plan conflicts with this document, the rules here apply until the decision log changes them.

The words **must**, **must not**, and **rejected** are normative. Everything in this document is in baseline scope unless it is explicitly marked **Future scope**. Baseline implementation must not close off future-scope rules.

## 2. Terms

| Term                  | Definition                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| Organization          | Ownership and data-isolation boundary. The initial launch uses a single organization.           |
| Organization timezone | IANA zone used for work dates and schedules; baseline `Asia/Jakarta`.                           |
| Server time           | Time from the application server/infrastructure, never a time sent by the user's device.        |
| Work date             | Calendar date in the organization timezone that keys one attendance record.                     |
| Working day           | A date that is scheduled as working and is not a holiday.                                       |
| Effective schedule    | The schedule that applies to an employee on a given work date.                                  |
| On-time deadline      | Scheduled start time plus late tolerance.                                                       |
| Complete record       | A record with both check-in and check-out.                                                      |
| Operational indicator | A transient condition such as "not checked in" or "not checked out"; not a final attendance status. |

## 3. Core invariants

1. All domain data must carry, or be traceable to, an `organizationId`.
2. An employee has at most one attendance record per work date.
3. Check-in, check-out, creation, decision, and audit times come from the server.
4. Employees cannot change attendance directly; changes after recording happen only through an approved correction.
5. A check-out cannot exist without a check-in, except as a proposed value in a correction that has not yet been applied.
6. Check-out must be greater than or equal to check-in.
7. New configuration must never automatically recalculate history.
8. Data from another organization, or outside the caller's scope, is treated as not found (`404`) rather than forbidden (`403`), to avoid leaking its existence.
9. Deactivating or soft-deleting an account does not delete attendance, correction, or audit history.
10. Check-in, check-out, close-day, and correction approval must be safe under retries and concurrency.

## 4. Identity, roles, and employee status

### 4.1 Accounts and employees

- A `User` has at most one active `Employee` profile in the same organization.
- Recording attendance requires an active account and an active employee profile.
- Admin/HR or Manager users who record attendance must have an employee profile in addition to their account role.
- A Manager is a user whose employee profile is the direct manager of at least one employee and who holds the Manager role.
- Email is the login identity. The employee number is the business identity and is never used as a password.

### 4.2 Employee number

- Required and unique within the organization.
- Normalized to uppercase before validation and storage.
- 3–32 characters.
- Must match `^[A-Z0-9][A-Z0-9-]{2,31}$` (e.g. `EMP-001`).
- Cannot be reused while history belongs to the previous profile.

### 4.3 Employee lifecycle

- `ACTIVE`: can log in (subject to user status) and record attendance during the active employment period.
- `INACTIVE`: cannot create new transactions; history remains readable by authorized users.
- Dates before `employmentStartDate` or after `employmentEndDate` are not working days for that employee.
- Deactivation must not produce `ABSENT` records after the effective deactivation date.
- Deactivating a user revokes active sessions using the existing authentication mechanism.
- An employee cannot be their own direct manager, and reporting lines must not form cycles.

## 5. Time and work dates

### 5.1 Storage and display

- All timestamps are stored as `timestamptz`/UTC with millisecond precision.
- The work date is stored as a date type (`YYYY-MM-DD`) and is not re-derived from timestamps at report time.
- The organization timezone is stored as an IANA zone name, not a fixed offset.
- The API returns ISO-8601 UTC timestamps and date-only values as `YYYY-MM-DD`.
- The UI shows dates and times in the organization timezone with a clear zone label.

### 5.2 Work date derivation

```text
serverNowUtc
  → convert to organization timezone
  → take the local calendar date
  → workDate
```

Device timezone and browser locale never affect `workDate`. Traveling employees follow the organization timezone. Per-assignment timezones are **Future scope**.

### 5.3 Organization timezone changes

- Only Admin/HR can change the timezone.
- A change must have an `effectiveFrom` no earlier than the next date in the old zone.
- Historical records keep the `timezone`, schedule times, and late threshold used when they were created.
- A timezone change does not shift historical `workDate` values.

## 6. Calendar and schedule

### 6.1 Baseline schedule

All values are configurable by Admin/HR for future dates.

| Property                | Baseline value |
| ----------------------- | -------------- |
| Working days            | Monday–Friday  |
| Start time              | 09:00:00       |
| End time                | 17:00:00       |
| Late tolerance          | 15 minutes     |
| Check-in opens          | 08:00:00       |
| Check-in closes         | 17:00:00       |
| Check-out deadline      | 23:59:59.999   |
| Timezone                | `Asia/Jakarta` |

Validation: `checkInOpensAt ≤ startTime < endTime`, `checkInOpensAt < checkInClosesAt`, `checkInClosesAt ≤ checkOutDeadline`, and all times fall on the same calendar date. Tolerance is 0–120 minutes.

### 6.2 Effective schedule

- The baseline uses a single organization default schedule.
- Schedules have an effective period and must not overlap within the same scope.
- Schedule changes take effect no earlier than the next work date.
- At check-in, the system stores a schedule snapshot: timezone, start, end, tolerance, check-in window, check-out deadline, and the source schedule ID.
- **Future scope:** priority order specific date/employee → employee shift → division schedule → organization schedule.

### 6.3 Non-working days and holidays

- Saturday and Sunday are not working days in the baseline schedule.
- Admin/HR manages public holidays per organization (date, name, active status).
- Check-in on a non-working day or an active holiday is rejected with `ATTENDANCE_NOT_WORKDAY`.
- Adding a holiday for a date that already has attendance records does not delete them; Admin/HR is warned, and such records stay unchanged.
- Holidays can be added or changed for past dates only with audit; the close-day job does not reprocess already-closed dates.
- Overtime and special working days are out of scope.

## 7. Check-in

### 7.1 Preconditions

Check-in is accepted only when all of the following are true:

1. The user is authenticated with an active session.
2. The user has an active employee profile in the same organization.
3. The current date is within the employee's employment period.
4. The date is a working day.
5. Server time is within the check-in window, inclusive at both ends.
6. No attendance record exists yet for the employee and work date.

### 7.2 Check-in window

- The window opens at `checkInOpensAt` (default 08:00:00) and closes at `checkInClosesAt` (default 17:00:00).
- Before the window: rejected with `CHECK_IN_TOO_EARLY`.
- After the window: rejected with `CHECK_IN_WINDOW_CLOSED`; the employee must submit a correction.
- Exactly on either boundary is allowed.

### 7.3 Status and lateness

```text
onTimeDeadline = scheduledStart + toleranceMinutes

checkInAt <= onTimeDeadline  → PRESENT, lateMinutes = 0
checkInAt >  onTimeDeadline  → LATE
```

For `LATE`, `lateMinutes` rounds up the difference in seconds between `checkInAt` and `onTimeDeadline`:

```text
lateMinutes = ceil((checkInAt - onTimeDeadline) / 60 seconds)
```

Examples for a 09:00 start and a 15-minute tolerance:

| Check-in | Status  | Late minutes |
| -------- | ------- | -----------: |
| 08:00:00 | PRESENT |            0 |
| 09:15:00 | PRESENT |            0 |
| 09:15:01 | LATE    |            1 |
| 09:16:00 | LATE    |            1 |
| 09:16:01 | LATE    |            2 |

### 7.4 Concurrency and idempotency

- The database must have a unique constraint on `(organizationId, employeeId, workDate)`.
- Attendance creation runs in a transaction.
- The check-in API accepts an `Idempotency-Key` unique per action attempt. A replay with the same key, user, and payload returns the first result without creating new data.
- Reusing a key with a different context is rejected.
- Two concurrent requests with different keys still produce one row; the losing request receives `ATTENDANCE_ALREADY_CHECKED_IN` and can fetch today's state.
- Keys are stored for at least 24 hours and are never shared across users.

## 8. Check-out

### 8.1 Preconditions

Check-out is accepted when:

1. The user and employee profile are still active.
2. A record exists for the current `workDate` with a check-in.
3. No check-out exists yet.
4. Server time is not earlier than check-in.
5. Server time has not passed the check-out deadline on the work date.

### 8.2 Time rules

- Check-out is allowed immediately after check-in; there is no minimum duration.
- Check-out before the end time is not blocked and does not change `PRESENT`/`LATE`. Early check-out rules are **Future scope**; the system must not display early check-out as a violation.
- After the deadline, the request is rejected with `CHECK_OUT_WINDOW_CLOSED` and must be fixed through a correction.
- Working duration is the elapsed time between check-in and check-out, rounded down to whole minutes.
- Duration is not a productivity measure and does not subtract breaks.

### 8.3 Concurrency and idempotency

- The update is conditional on `checkOutAt IS NULL` within a transaction (or an equivalent compare-and-set).
- The API uses `Idempotency-Key` with the same rules as check-in.
- Parallel requests must never overwrite the first timestamp.

## 9. Statuses and indicators

### 9.1 Stored attendance status

| Status    | Meaning                                                      | Availability  |
| --------- | ------------------------------------------------------------ | ------------- |
| `PRESENT` | Checked in on time.                                          | Baseline      |
| `LATE`    | Checked in after the on-time deadline.                       | Baseline      |
| `ABSENT`  | Working day closed with no check-in.                         | Baseline      |
| `EXCUSED` | Working day excused by approved leave/sick/time off.         | Future scope  |

API and database codes and UI labels are in English (UI labels: Present, Late, Absent, Excused).

### 9.2 Completion

Completion is a separate dimension from status:

- `NOT_STARTED`: no check-in yet (read model only).
- `OPEN`: check-in exists, check-out does not.
- `COMPLETE`: both check-in and check-out exist.
- `NOT_APPLICABLE`: absent or excused.

A record can be `LATE` with completion `OPEN`. The "Incomplete" label in reports comes from completion and does not replace `LATE`. A record that is `OPEN` after its check-out deadline is **incomplete**.

### 9.3 Dashboard indicators

- **Not checked in:** working day, time is past the on-time deadline, no check-in, and the day is not yet closed.
- **Not checked out:** check-in exists, no check-out, and time is past the end time.
- **Late:** stored status `LATE`.
- **Absent:** stored status `ABSENT` after the close-day job. For "absent today" on dashboards before close-day, use "Not checked in" after the check-in window closes.

## 10. Close-day and absence

- The job runs daily at 00:05 in the organization timezone and processes the previous date.
- It processes only employees who are active and scheduled on that date.
- Non-working days and holidays never produce `ABSENT`.
- If a record with check-in exists, the job does not change `PRESENT`/`LATE`; records without check-out stay `OPEN` (incomplete).
- If no record exists, the job creates an `ABSENT` record with completion `NOT_APPLICABLE` and the close-day run ID.
- The same unique constraint prevents duplicates.
- The job must be idempotent and re-runnable, and must log created, skipped, and failed counts plus a correlation ID.
- Partial failures must be resumable without recalculating rows that already succeeded.
- Admin/HR can trigger a re-run for a specific date; the run is audited.

## 11. Corrections

### 11.1 Scope

A correction can propose:

- Adding a forgotten check-in (for an `ABSENT` record).
- Changing a check-in.
- Adding a forgotten check-out (for an `OPEN` record).
- Changing a check-out.

Employees do not propose a status. The system recalculates status, late minutes, duration, and completion from the proposed timestamps and the record's schedule snapshot (or the effective schedule for `ABSENT` records, which have no snapshot).

A correction always targets an existing attendance record. For a work date with no record yet (check-in window closed today), the employee submits the correction after close-day has created the `ABSENT` record.

### 11.2 Deadline

- An employee can submit up to 23:59:59 on the seventh calendar day after `workDate`, in the organization timezone. Later submissions are rejected with `CORRECTION_WINDOW_CLOSED`; there is no override.
- The deadline applies to every role, including Admin/HR submitting their own corrections.
- A pending request does not expire and is never auto-approved.

### 11.3 Request status

```text
PENDING → APPROVED
PENDING → REJECTED
```

Final statuses cannot change. Further changes require a new request.

### 11.4 Validation

- Requester reason is required, 10–1,000 characters after trimming.
- Proposed values must produce a valid time pair on the work date (check-out ≥ check-in, both within the work date).
- Proposed values must differ from the current values.
- At most one `PENDING` request per attendance record (`CORRECTION_ALREADY_PENDING`).
- The requester can never decide their own request, regardless of role (`CORRECTION_SELF_APPROVAL_FORBIDDEN`).
- A Manager can decide only requests from their active direct reports.
- Admin/HR can decide any request in the organization except their own.
- A request whose requester has no eligible decider (e.g. no direct manager) is decided by Admin/HR.
- A decision note is required for rejection (10–1,000 characters) and optional for approval.
- If the attendance record changed after submission, approval is rejected with `CORRECTION_VERSION_CONFLICT`; the employee must submit a new request.

### 11.5 Atomic decision

Within one transaction, the system must:

1. Update the request from `PENDING` to the decision only if it is still `PENDING` (conditional update). If zero rows are updated, return `CORRECTION_ALREADY_DECIDED`.
2. For approval, verify the attendance version.
3. Store the before snapshot.
4. Apply the approved timestamps.
5. Recalculate status, late minutes, duration, and completion; mark the record `corrected`.
6. Store the after snapshot.
7. Record decider, decision note, and server decision time.
8. Write the audit event.

Rejection does not change attendance. The first valid decision is final; any later decision receives a conflict and applies nothing.

## 12. History and data access

- Employees can read all of their own history within the retention period.
- Managers can read today's status and the last 90 days of history for their active direct reports.
- Admin/HR can read history for the whole organization.
- Lists are paginated: default 20, maximum 100 per page.
- Default sort is `workDate` descending.
- Date filters use date-only values in the organization timezone.
- Out-of-scope objects return `404 NOT_FOUND`.

## 13. Reports and summaries

- Reports use `workDate`, not the UTC date of timestamps.
- `workedMinutes = floor((checkOutAt - checkInAt) / 60 seconds)` when both exist.
- `OPEN` records have no final `workedMinutes` and are counted as incomplete.
- Present counts `PRESENT`; late counts `LATE`; they do not overlap. Attended = present + late.
- `ABSENT` counts only records created by close-day or kept after correction.
- Non-working days, holidays, and `EXCUSED` are never counted as absent.
- Approved corrections show the latest values with `corrected=true`.
- Summary figures must reconcile with record-level data for the same filter.
- Trends aggregate daily counts of present, late, absent, and incomplete over the selected range.
- Managers see reports scoped to their direct reports; Admin/HR sees the organization.

### 13.1 CSV export (Should)

- Uses the same filter and order as the report screen, UTF-8 with BOM.
- Cells starting with `=`, `+`, `-`, `@`, tab, or carriage return are neutralized to prevent formula injection.
- Minimum columns:

1. `workDate`
2. `employeeNumber`
3. `employeeName`
4. `divisionName`
5. `timezone`
6. `scheduledStart`
7. `scheduledEnd`
8. `checkInAt`
9. `checkOutAt`
10. `attendanceStatus`
11. `lateMinutes`
12. `workedMinutes`
13. `completionStatus`
14. `corrected`
15. `note`

## 14. Audit

Minimum audited events:

- Organization settings, schedule, or holiday changed.
- Employee or division created, updated, deactivated, or reactivated; role or manager assignment changed.
- Successful check-in and check-out.
- Close-day job created `ABSENT` records, or was re-run.
- Correction submitted, approved, or rejected.
- Report export created.

Audit stores actor, organization, action, target, timestamp, request ID, and non-sensitive change metadata. Passwords, tokens, cookies, and raw request bodies must never be logged. Audit uses the boilerplate's existing audit log module.

## 15. Retention and privacy

- Attendance, corrections, and audit: five years from `workDate`/event, configurable, subject to legal review before production.
- Export artifacts: deleted automatically after 24 hours.
- Inactive user/employee data is retained or pseudonymized per legal requirements without breaking historical references.
- No precise location, photos, biometrics, or device identifiers are collected.

## 16. Stable domain error codes

| Code                                 | HTTP | Condition                                         |
| ------------------------------------ | ---: | ------------------------------------------------- |
| `EMPLOYEE_PROFILE_REQUIRED`          |  422 | User has no employee profile.                     |
| `EMPLOYEE_INACTIVE`                  |  422 | Profile is not active on the work date.           |
| `ATTENDANCE_NOT_WORKDAY`             |  422 | Date is a weekend, holiday, or non-working day.   |
| `CHECK_IN_TOO_EARLY`                 |  422 | Before the check-in window.                       |
| `CHECK_IN_WINDOW_CLOSED`             |  422 | After the check-in window.                        |
| `ATTENDANCE_ALREADY_CHECKED_IN`      |  409 | A record/check-in already exists.                 |
| `ATTENDANCE_NOT_CHECKED_IN`          |  409 | Check-out requested without check-in.             |
| `ATTENDANCE_ALREADY_CHECKED_OUT`     |  409 | Check-out already recorded.                       |
| `CHECK_OUT_WINDOW_CLOSED`            |  422 | Check-out deadline has passed.                    |
| `IDEMPOTENCY_KEY_REUSED`             |  409 | Key used with a different context.                |
| `CORRECTION_WINDOW_CLOSED`           |  422 | Past the seven-day submission deadline.           |
| `CORRECTION_ALREADY_PENDING`         |  409 | A pending request already exists for the record.  |
| `CORRECTION_VERSION_CONFLICT`        |  409 | Attendance changed after submission.              |
| `CORRECTION_ALREADY_DECIDED`         |  409 | Another decision was made first.                  |
| `CORRECTION_SELF_APPROVAL_FORBIDDEN` |  403 | Requester tried to decide their own request.      |
| `REPORTING_LINE_CYCLE`               |  422 | Manager assignment would create a cycle.          |
| `MANAGER_INACTIVE`                   |  422 | The chosen manager is inactive.                   |
| `EMPLOYMENT_PERIOD_INVALID`          |  422 | Employment end date is before the start date.     |
| `EMPLOYEE_NUMBER_TAKEN`              |  409 | Number already used in the organization.          |
| `EMPLOYEE_HAS_ACCOUNT`               |  409 | Employee already has a user account.              |
| `USER_HAS_EMPLOYEE`                  |  409 | User already belongs to another employee.         |
| `DIVISION_CODE_TAKEN`                |  409 | Division code already used.                       |
| `DIVISION_NAME_TAKEN`                |  409 | Division name already used (ignoring case).       |
| `DIVISION_INACTIVE`                  |  422 | Division is inactive; no new assignments.         |
| `HOLIDAY_DATE_CONFLICT`              |  409 | An active holiday already exists for the date.    |

Messages are in English and may change; codes must not change once released in API v1.

## 17. Acceptance scenarios

### Scenario A — Exactly at tolerance

With a 09:00 start and 15-minute tolerance, a server check-in at 09:15:00 is `PRESENT` with `lateMinutes=0`.

### Scenario B — One second late

A check-in at 09:15:01 is `LATE` with `lateMinutes=1`.

### Scenario C — Double-click

Two simultaneous requests from the same employee do not create two records. A replay with the same idempotency key returns the first result; other requests receive the latest state or a stable conflict.

### Scenario D — Device in another timezone

The employee is in Tokyo, but the organization uses `Asia/Jakarta`. Buttons, work date, and status follow Jakarta time.

### Scenario E — Forgotten check-out

The employee checks in and passes the deadline without checking out. The record stays `PRESENT` or `LATE` with completion `OPEN` (incomplete). The employee submits a correction within seven days.

### Scenario F — Schedule change

HR changes the start time from 09:00 to 08:30 effective tomorrow. Today's and earlier records keep the 09:00 snapshot.

### Scenario G — Concurrent decisions

A Manager and HR open the same request. The first successful decision is final; the second receives `CORRECTION_ALREADY_DECIDED` and applies nothing.

### Scenario H — Holiday

Admin/HR marks a Wednesday as a public holiday. Check-in that day is rejected with `ATTENDANCE_NOT_WORKDAY`, and close-day creates no `ABSENT` records for it.

### Scenario I — Self-approval

An Admin/HR user with an employee profile submits a correction. They cannot decide it; another Admin/HR or their direct manager must.

### Scenario J — UTC/Jakarta boundary

At 2026-11-02 23:30 UTC (2026-11-03 06:30 Jakarta), the work date is `2026-11-03`, and check-in is rejected as `CHECK_IN_TOO_EARLY`.
