# Attendance Verification Plan — Location and Selfie Checks

| Attribute     | Value                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Status        | Planning — not approved for implementation                            |
| Version       | 0.1                                                                   |
| Date          | 1 November 2026                                                       |
| Product owner | Developer                                                             |
| Roadmap       | [`PLANS.md`](PLANS.md) Phase 7 (7.0 privacy gate, 7A location, 7B selfie) |

## 1. Why this needs a gate

Today Hadir.in promises the opposite of this feature:

- PRD §4 lists "continuous location tracking, geofencing, selfies, face recognition, or biometrics" as non-goals, and PRD §13 allows geolocation and selfies **only after a privacy impact assessment and legal review**.
- `DOMAIN_RULES.md` §15: "No precise location, photos, biometrics, or device identifiers are collected."
- `UX_FLOWS.md` §21 tells employees no location or photos are collected, and says "Never request geolocation, camera, or device fingerprint permissions."
- The web app sends `Permissions-Policy: camera=(), microphone=(), geolocation=()`, which blocks both browser APIs.

So no code is written until Phase 7.0 (§4) is approved. Changing those promises is itself a product decision, and employees must be told before anything is collected.

## 2. What problem this solves (to confirm)

Hadir.in records when people say they started and stopped work, judged by server time. It cannot show _where_ they were or _who_ pressed the button. The product owner should confirm which of these is the real problem, because each leads to a different design:

| Problem                                         | Fits                    | Weakness                                                                   |
| ----------------------------------------------- | ----------------------- | -------------------------------------------------------------------------- |
| "Someone checks in for a colleague"             | Selfie (human review)   | Photos are personal data; review takes manager time.                       |
| "People check in while not at their work place" | Location at check-in    | For WFH the work place is the employee's home: storing it is sensitive.    |
| "We need evidence for disputes"                 | Either, kept briefly    | Retention must be short, or the evidence becomes the risk.                 |
| "Trust is fine; HR wants a deterrent"           | Neither — policy instead | Collection without a concrete need fails data minimisation.               |

If the answer is the last row, the recommendation is not to build this.

## 3. Principles

These hold for every option below and go into `DOMAIN_RULES.md` when approved.

1. **Moment only, never tracking.** Location or a photo is captured once, at the moment of check-in or check-out, and only when the employee presses the button. No background or repeated collection.
2. **Purpose-limited.** Used only to verify that attendance action. Never for productivity, performance scoring, or anything else.
3. **Off by default.** An organization switches each method on; nothing changes for organizations that don't.
4. **Told first.** Employees see a notice explaining what is collected, why, who can see it and for how long, before the first collection. The privacy copy in `UX_FLOWS.md` §21 is rewritten to match.
5. **Flag, don't punish.** A failed or missing check never blocks attendance or changes its status automatically. It is flagged for a person to review (recommended; see decision V4).
6. **Minimal and short-lived.** Store the result, not the raw data, where possible. Raw data (coordinates, photos) is deleted on a short schedule.
7. **Narrow access, always audited.** Only the employee, their direct manager and Admin/HR can see verification details; every view of a photo is written to the audit log.
8. **Honest about limits.** Browser location and camera input can be faked. The feature is a deterrent and a dispute aid, not proof; the UI and docs never claim otherwise.
9. **No biometrics.** No face matching or face templates (see §6.3).

## 4. Phase 7.0 — Privacy gate (no code)

**Deliverables:**

- **Privacy impact assessment** covering both methods: purpose and necessity, data collected, legal basis, retention, access, risks to employees and their mitigations. Indonesia's Personal Data Protection Law (UU PDP, Law No. 27 of 2022) is the reference; our reading is that biometric data is "specific personal data" and that systematic monitoring of employees calls for an impact assessment. Legal review confirms this — it is not settled by this plan.
- **Legal review** of the assessment, the employee notice, the legal basis (consent is weak between employer and employee; legitimate interest or contract may fit better), retention periods, and whether a home location may be stored at all.
- **Employee notice** text, and how employees acknowledge it.
- **Decision record** in PRD §13 and a new PRD decision row: which methods, for which organization, with which settings.
- **Updated promises:** `DOMAIN_RULES.md` §15, `UX_FLOWS.md` §21 and PRD §4 changed to say exactly what is now collected.

**Approval gate:** Product owner and legal reviewer approve the assessment. Without that, Phases 7A and 7B do not start.

## 5. Phase 7A — Location at check-in and check-out

### 5.1 Behaviour

1. The organization turns on location checks and chooses a mode (decision V2):
   - **Record only:** store whether a location was shared and how accurate it was. No comparison.
   - **Approved area:** compare it with an approved area (for example, the employee's declared work-from-home area or an office) and store inside / outside / unknown.
2. When the employee presses Check in or Check out, the browser asks for location once (the Geolocation API with a short timeout). The button stays usable while it waits.
3. The client sends latitude, longitude and accuracy with the check-in request. The server still decides the time; the location is only evidence.
4. The server computes the result and stores it with the attendance record:
   - `inside`, `outside`, `low_accuracy` (accuracy worse than a threshold, for example 500 m), `not_shared` (denied, unavailable or timed out).
5. Attendance is recorded whatever the result. A result other than `inside` (or, in record-only mode, `not_shared`) shows as a flag to the manager and Admin/HR.
6. Raw coordinates (decision V3, recommended):
   - Not stored at all in "approved area" mode: only the result, the distance rounded to a band (for example under 1 km, 1–10 km, over 10 km) and the accuracy.
   - If stored, kept for at most 30 days, then deleted by a cleanup job.

### 5.2 Approved areas

- An area is a centre point and a radius (for example 1 km). Per employee for WFH, or per organization for an office.
- Admin/HR sets areas, or the employee declares theirs and Admin/HR approves it (decision V5). Every change is audited.
- Storing an employee's home area is the most sensitive part of this phase; legal review in 7.0 decides whether it is allowed and at what precision.

### 5.3 Changes by layer

- **Data model:** `AttendanceVerification` (attendance, action `check_in`/`check_out`, method `location`, result, accuracy in metres, distance band, server time captured), `WorkLocation` (organization, optional employee, label, centre, radius, status, effective dates), and verification settings on the organization (method on/off, mode, accuracy threshold, retention).
- **API:** check-in/out accept an optional `location { latitude, longitude, accuracyMeters }` (strict Zod; rejected when the organization hasn't turned location on). New endpoints to manage work locations and verification settings (`policy:manage`). Team and organization views gain a verification flag and filter. OpenAPI regenerated.
- **Permissions:** viewing flags follows existing scopes (`attendance:read_team`, `attendance:read_all`); managing areas uses `policy:manage`.
- **Frontend:** location request on the today card, with clear states (asking, shared, not shared, low accuracy) and a link to the privacy notice; a flag badge in team, record and report views; an Admin/HR settings page; `Permissions-Policy` allows `geolocation=(self)` (only when the organization has it on, if feasible, otherwise for the app's own origin).
- **Domain rules:** a new section for verification results, the accuracy threshold, the distance bands and the "never blocks attendance" rule.
- **Audit:** settings changes, area changes; the result is part of the check-in/out event metadata (the band, never coordinates).

### 5.4 Acceptance criteria

- With location off, nothing changes: no permission prompt, no new fields accepted.
- With it on, each check-in and check-out stores exactly one result; denying permission still records attendance with `not_shared`.
- Results at the edge of an area and at the accuracy threshold match the domain rule (unit tests on the distance calculation).
- Raw coordinates never appear in logs, audit metadata, exports or API responses to anyone other than (at most) Admin/HR within the retention window.
- The cleanup job removes raw coordinates after the retention period (e2e with the fixed clock).
- Managers see flags only for their direct reports (negative tests).

## 6. Phase 7B — Selfie at check-in

### 6.1 Behaviour

1. The organization turns on selfie checks (decision V6: check-in only, or both).
2. Pressing Check in opens the camera (`getUserMedia`) in the browser; the employee takes one photo and can retake it. Uploading a file from the gallery is not offered.
3. The photo is uploaded through the existing presigned upload flow (`uploads` module) to private object storage, then attached to the check-in request by upload ID. The server checks the upload belongs to the caller, is an image, and was created moments before.
4. Attendance is recorded whatever happens with the photo; a missing photo is flagged.
5. The direct manager and Admin/HR can view the photo from the record or the team view, through a short-lived signed URL. Each view is audited.
6. Photos are deleted after a short period (decision V3; recommended 30 days, longer only while a correction or dispute on that record is open).

### 6.2 Changes by layer

- **Data model:** `AttendanceVerification` with method `selfie`, result (`captured`, `not_captured`), upload reference; a retention date per photo.
- **Uploads:** a new upload purpose for attendance photos, smaller size limit (for example 2 MB, JPEG/WebP), stricter key prefix, and a cleanup job for expired photos.
- **API:** check-in accepts an optional `selfieUploadId`; a `GET` for a photo's signed URL, scoped like the record and audited.
- **Frontend:** camera capture dialog with retake, upload progress, failure states that don't block check-in, and a photo viewer for reviewers. `Permissions-Policy` allows `camera=(self)`.
- **Domain rules and audit:** as for location; audit records each photo view (who viewed whose photo, when).

### 6.3 Not in this phase: face matching

Comparing the selfie with a reference face would process biometric data: the strictest category, with vendor, accuracy, bias and liveness problems. It is out of scope; it would need its own assessment and decision.

### 6.4 Acceptance criteria

- With selfies off, the camera is never requested.
- A photo from another user, another organization, a non-image or an old upload is rejected.
- Only the employee, their direct manager and Admin/HR can open a photo; every open is in the audit log; others get 404.
- Photos are deleted on schedule, except while a linked correction is pending.
- Denying camera access still allows check-in, with the flag.

## 7. Risks

| Risk                                          | Mitigation                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| Treated as surveillance; trust drops          | Moment-only capture, notice first, flags instead of penalties, short retention. |
| Spoofed location or photo                     | Documented as a deterrent; human review of flags; no automatic penalties.  |
| Home locations or photos leak                 | Store results not raw data; private bucket; short retention; audited access. |
| Employees without a camera, or who refuse     | Never blocks attendance; HR handles flags case by case.                    |
| Scope creep into tracking or face recognition | Principles in domain rules; any extension needs a new decision.            |

## 8. Decisions needed before Phase 7.0 closes

| #   | Decision                                                       | Recommendation                                                   |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| V1  | Which problem from §2 are we solving?                         | Confirm before anything else.                                    |
| V2  | Location mode: record only, or approved area?                 | Start with record only; add areas only if legal allows home areas. |
| V3  | Retention of raw coordinates and photos                       | Coordinates not stored; photos 30 days.                          |
| V4  | Does a failed check ever block attendance?                    | No — flag for review only.                                       |
| V5  | Who sets an employee's approved area?                         | Employee declares, Admin/HR approves.                            |
| V6  | Selfie at check-in only, or check-out too?                    | Check-in only.                                                   |
| V7  | Which methods for the pilot organization, and when?          | Location first; selfie only if V1 says impersonation is the problem. |

## 9. Recommended order

Build notifications (Phase 6, [`NOTIFICATIONS_PLAN.md`](NOTIFICATIONS_PLAN.md)) first: it carries little privacy risk and its background jobs and settings patterns are reused here. Run the Phase 7.0 privacy gate in parallel, since it is mostly writing and review. Then 7A, then 7B if it is still needed.
