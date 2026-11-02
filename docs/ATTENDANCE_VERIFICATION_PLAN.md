# Attendance Verification Plan — Location and Selfie Checks

| Attribute     | Value                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Status        | Implemented, off by default — production gated (§4.1); not independently reviewed |
| Version       | 0.5                                                                   |
| Date          | 2 November 2026                                                       |
| Product owner | Developer                                                             |
| Roadmap       | [`PLANS.md`](PLANS.md) Phase 7 (7.0 privacy gate, 7A location, 7B selfie) |

## 1. Why this needs a gate

Today Hadir.in promises the opposite of this feature:

- PRD §4 lists "continuous location tracking, geofencing, selfies, face recognition, or biometrics" as non-goals, and PRD §13 allows geolocation and selfies **only after a privacy impact assessment and legal review**.
- `DOMAIN_RULES.md` §15: "No precise location, photos, biometrics, or device identifiers are collected."
- `UX_FLOWS.md` §21 tells employees no location or photos are collected, and says "Never request geolocation, camera, or device fingerprint permissions."
- The web app sends `Permissions-Policy: camera=(), microphone=(), geolocation=()`, which blocks both browser APIs.

So nothing is collected until legal approves (§4). Changing those promises is itself a product decision, and employees must be told before anything is collected.

## 2. What problem this solves

Hadir.in records when people say they started and stopped work, judged by server time. It cannot show _where_ they were or _who_ pressed the button. Each of these problems leads to a different design. Decision V1 chose the first two rows:

| Problem                                         | Fits                    | Weakness                                                                   |
| ----------------------------------------------- | ----------------------- | -------------------------------------------------------------------------- |
| "Someone checks in for a colleague"             | Selfie (human review)   | Photos are personal data; review takes manager time.                       |
| "People check in while not at their work place" | Location at check-in    | For WFH the work place is the employee's home: storing it is sensitive.    |
| "We need evidence for disputes"                 | Either, kept briefly    | Retention must be short, or the evidence becomes the risk.                 |
| "Trust is fine; HR wants a deterrent"           | Neither — policy instead | Collection without a concrete need fails data minimisation.               |

The last row on its own would not have justified building this.

## 3. Principles

These hold for every option below and go into `DOMAIN_RULES.md` when approved.

1. **Moment only, never tracking.** A photo and location are captured once at check-in and once at check-out, when the employee takes the photo. The location is read with the photo. No background or automatic repeated collection.
2. **Purpose-limited.** Used only to verify that attendance action. Never for productivity, performance scoring, or anything else.
3. **Off by default.** Each method is configured separately per organization and stays off until approved; nothing changes for organizations that don't turn one on.
4. **Told first.** Employees see a notice explaining what is collected, why, who can see it and for how long, before the first collection. The privacy copy in `UX_FLOWS.md` §21 is rewritten to match.
5. **Required to record, then flag, don't punish.** While a method is on, a check-in or check-out isn't recorded without its evidence (product owner, 2 November 2026). Once recorded, the result never changes attendance or its status: it is flagged for Admin/HR to review (decision V4), and nobody is automatically marked absent, late or fraudulent.
6. **Minimal and short-lived.** Store the result, not the raw data, where possible. Raw data (coordinates, photos) is deleted on a short schedule.
7. **Narrow access, always audited.** Direct managers see verification status and review flags only. Only authorized Admin/HR personnel can open a photo, and every access is written to the audit log (decision V9). Retention and access are enforced by the backend, not only the UI.
8. **Honest about limits.** Browser location and camera input can be faked. The feature is a deterrent and a dispute aid, not proof; the UI and docs never claim otherwise.
9. **No biometric processing.** No face matching or face templates (see §6.3). A stored selfie may still legally count as biometric data, so it is treated as specific personal data until legal review decides (assessment Q1).
10. **Evidence kept apart.** Verification evidence is stored separately from attendance records, and deleting it never changes an attendance record.

## 4. Phase 7.0 — Privacy gate (no code)

**Draft:** [`ATTENDANCE_VERIFICATION_PIA.md`](ATTENDANCE_VERIFICATION_PIA.md) holds the assessment, the employee notice and the questions for legal review.

**Deliverables:**

- **Privacy impact assessment** covering both methods: purpose and necessity, data collected, legal basis, retention, access, risks to employees and their mitigations. Indonesia's Personal Data Protection Law (UU PDP, Law No. 27 of 2022) and its implementing regulation (PP 33/2026, in force from 16 January 2027) are the reference; our reading is that biometric data is "specific personal data" and that systematic monitoring of employees calls for an impact assessment. Legal review confirms this — it is not settled by this plan.
- **Legal review** of the assessment, the employee notice, the legal basis (consent is weak between employer and employee; legitimate interest or contract may fit better), retention periods, and whether a home location may be stored at all.
- **Employee notice** text, and how employees acknowledge it.
- **Decision record:** PRD decision 26, pointing to §8.
- **Updated promises:** `DOMAIN_RULES.md` §15, `UX_FLOWS.md` §21 and PRD §4 now say nothing is collected until a method is legally approved and enabled.

**Closing 7.0:** the product decisions in §8 are the baseline, and Phase 7.0 closes on them (product owner, 2 November 2026).

**Legal compliance status: not independently reviewed.** No external lawyer reviewed the assessment, and none is required for development (product owner, 2 November 2026). Nothing in Phase 7 claims production compliance or readiness.

**Production gate:** location and selfie verification stay off in production until the deferred requirements below are met. Two switches enforce this: the deployment's `VERIFICATION_ENABLED` (backend and frontend, off by default), and each organization's setting, which also needs a recorded reason (decision V7). With the deployment switch off, `Permissions-Policy` keeps blocking the camera and location, and the promises in `DOMAIN_RULES.md` §15, `UX_FLOWS.md` §21 and PRD §4 still describe what happens.

### 4.1 Deferred requirements

Tracked here, apart from the implementation tasks. Each must be met before real employee verification data is collected in production.

| #   | Requirement                                                                                       | Status   |
| --- | ------------------------------------------------------------------------------------------------- | -------- |
| D1  | Reassess applicable legal requirements (assessment §10), including PP 33/2026 from 16 January 2027 | Deferred |
| D2  | Production hosting inventory: providers, regions, database and backup locations, sub-processors  | Deferred |
| D3  | Documented necessity for each method an organization turns on, from the incident log (decision V7) | Open; log kept in [`ATTENDANCE_INCIDENT_LOG.md`](ATTENDANCE_INCIDENT_LOG.md) |
| D4  | Breach response procedure (assessment §8)                                                         | Deferred |
| D5  | Reassess the legal basis now that evidence is mandatory (assessment §1), and how anyone who can't comply records attendance | Deferred |

## 5. Phase 7A — Location at check-in

### 5.1 Behaviour

1. The organization turns on location checks. The only mode is approved area (decision V2): compare the location with the employee's approved work-from-home area and store the result. If legal doesn't approve it, location verification stays disabled; it isn't replaced with record-only.
2. Pressing Check in or Check out opens the capture dialog (§6.1). The location is read once, when the photo is taken, or when the employee shares it if photos are off. There is no separate way to share a location.
3. The reading goes with the request to `POST /attendance-verification/check-in` or `check-out`. Without it nothing is recorded. The plain `POST /attendance/check-in` and `check-out` are refused with `VERIFICATION_REQUIRED` while a method is on.
4. The server computes the result and stores it apart from the attendance record, one row per moment:
   - `verified`, `outside_approved_area`, `low_accuracy` (accuracy worse than a threshold, for example 500 m), `no_approved_area`. `not_shared` remains only on results recorded before this change.
5. Attendance is recorded whatever the result, once a reading exists. `outside_approved_area` is flagged for review, and doesn't block. `low_accuracy` is shown as a neutral "Couldn't confirm", isn't a failure, and is never flagged on its own (decision V11). Without an approved area the result is `no_approved_area`, unflagged, and attendance is still recorded.
6. Raw coordinates are never persisted (decision V3): only the result, the distance rounded to a band (for example under 1 km, 1–10 km, over 10 km) and the accuracy.
7. Verification results are deleted automatically after 90 days; the attendance record is unaffected (decision V8).
8. A result is final. Before using a photo the employee can retake it, and a retake reads the location again.
9. Managers see only the status label. Authorized Admin/HR can also see accuracy diagnostics when necessary, never raw coordinates (decision V11).

### 5.2 Approved areas

- An area is a centre point and a radius (for example 1 km), per employee.
- The employee declares their area and Admin/HR approves it. Changes are requested the same way and only become active once approved. Managers may recommend a change but can't approve one unless explicitly authorized (decision V5). Approving needs `verification:manage`; a recommendation is made outside the app for now.
- Every request, approval and change is in the audit history, which records who, when and the outcome, never the centre point.
- Storing an employee's home area is the most sensitive part of this phase; legal review in 7.0 decides whether it is allowed and at what precision.

### 5.3 Changes by layer

- **Data model:** `AttendanceVerification` (its own table referencing the attendance record; method `location`, result, accuracy in metres, distance band, server time captured, deletion date), `WorkLocation` (organization, optional employee, label, centre, radius, status, effective dates), and verification settings on the organization (each method on/off, off by default; accuracy threshold).
- **API:** `POST /attendance-verification/check-in` and `check-out` take `{ location?: { latitude, longitude, accuracyMeters } }` and an `Idempotency-Key` (strict Zod; refused when the methods are off, the notice hasn't been acknowledged, or the evidence is missing). Responses for managers leave out accuracy and distance band, enforced by the backend. New endpoints to manage work locations and verification settings (`policy:manage`). Team and organization views gain a verification flag and filter. OpenAPI regenerated.
- **Permissions:** viewing status and flags follows existing scopes (`attendance:read_team`, `attendance:read_all`); approving areas uses `policy:manage`. Enabling a method also requires a deployment-level switch, off by default, so it can't be turned on in production from the settings page alone.
- **Frontend:** the Check in and Check out buttons open the capture dialog, with clear failure states and nothing recorded until they pass; results and the approved area inside the today card; a flag badge in team, record and report views; an Admin/HR settings page; `Permissions-Policy` allows `geolocation=(self)` only where the deployment switch is on.
- **Domain rules:** a new section for verification results, the accuracy threshold, the distance bands and the rule that evidence is required to record but the result never changes attendance.
- **Audit:** settings changes, area requests and approvals. The result stays out of check-in event metadata, because audit is kept for five years and results for 90 days (decision V8).

### 5.4 Acceptance criteria

- With location off, nothing changes: no permission prompt, no new fields accepted.
- With it on, each check-in and check-out stores exactly one result; without a reading nothing is recorded.
- `low_accuracy` creates no review flag, and attendance is recorded as usual.
- Manager responses contain the status label only; Admin/HR diagnostics never contain coordinates.
- Results at the edge of an area and at the accuracy threshold match the domain rule (unit tests on the distance calculation).
- Raw coordinates are never stored and never appear in logs, audit metadata, exports or API responses.
- The cleanup job deletes results after 90 days and leaves the attendance record unchanged (e2e with the fixed clock).
- A change to an approved area has no effect until Admin/HR approves it; a manager without explicit authorization gets a refusal.
- Managers see status and flags only for their direct reports (negative tests).

## 6. Phase 7B — Selfie at check-in

### 6.1 Behaviour

1. The organization turns on selfie checks, which apply at check-in and check-out (decision V6). Decision V7 sets when this phase may start.
2. Pressing Check in or Check out opens the camera (`getUserMedia`) in the browser; the employee takes one photo and can retake it. Uploading a file from the gallery is not offered. There is no separate way to take a photo.
3. The photo goes straight from the browser to private object storage through a signed URL, under its own key prefix, before anything is recorded. It is not in the `uploads` module, whose files anyone in the organization can list and read. The server checks the bytes are a JPEG or WebP of the declared size before recording. A photo never used is removed by the cleanup job after a day.
4. Attendance isn't recorded without the photo. Selfies are review evidence only: the photo itself never changes the record.
5. Authorized Admin/HR personnel can view the photo through a short-lived signed URL, and each view is audited. Direct managers see status and flags, and can't view or download photos (decision V9).
6. Photos are deleted automatically after 30 days. An exception needs a documented legal or investigation requirement (decision V3); there is no hold mechanism yet, so every photo is deleted on schedule.
7. There is no in-app photo viewer in the initial implementation, including for the employee. An employee can request their own photos through an authorized Admin/HR process. Admin/HR verifies the requester's identity before disclosing anything, and both the request and the disclosure are audit-logged (decision V12).

### 6.2 Changes by layer

- **Data model:** `AttendanceVerification` with method `selfie`, moment, result `captured`, upload reference; a retention date per photo, stored apart from the attendance record. `VerificationPendingPhoto` holds the upload until its check-in or check-out is recorded.
- **Storage:** its own signed-URL flow (not the `uploads` table), 2 MB, JPEG or WebP, key prefix `verification-selfies/<organization>/`, and a cleanup job that deletes the file outright, skipping the seven-day soft-delete window other uploads get.
- **API:** `POST /attendance-verification/photo-upload` signs the upload for a moment, and recording checks it; `GET /attendance-verification/:id/photo` returns a signed URL, audited and limited to `verification:read_photo`, which is granted separately from `attendance:read_all` and `verification:manage`.
- **Frontend:** camera capture dialog with retake, upload progress, failure states that don't block check-in, and a photo viewer for reviewers. `Permissions-Policy` allows `camera=(self)` only after legal approval.
- **Domain rules and audit:** as for location; audit records each photo view (who viewed whose photo, when) and each access request and disclosure. Photos and results are never included in attendance exports.

### 6.3 Not in this phase: face matching

Comparing the selfie with a reference face would process biometric data: the strictest category, with vendor, accuracy, bias and liveness problems. It is out of scope; it would need its own assessment and decision.

### 6.4 Acceptance criteria

- With selfies off, the camera is never requested. With both methods off, check-in and check-out work as before.
- A photo from another user, another organization, a non-image or an old upload is rejected.
- Only Admin/HR personnel holding the photo permission can open a photo; every open is in the audit log; everyone else, including direct managers, gets 404.
- Photos are deleted after 30 days (e2e with the fixed clock).
- Denying camera or location access records nothing and says so; the employee can allow it and try again, or contact Admin/HR.
- An employee has no in-app route to a photo; a disclosure can't be recorded without an identity check, and the request and disclosure are both in the audit log.

## 7. Risks

| Risk                                          | Mitigation                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| Treated as surveillance; trust drops          | Moment-only capture, notice first, flags instead of penalties, short retention. |
| Spoofed location or photo                     | Documented as a deterrent; human review of flags; no automatic penalties.  |
| Home locations or photos leak                 | Store results not raw data; private bucket; short retention; audited access. |
| Employees without a camera, or who refuse     | Can't record attendance themselves: Admin/HR handles it through a correction. The largest cost of the mandatory approach. |
| Scope creep into tracking or face recognition | Principles in domain rules; any extension needs a new decision.            |

## 8. Product decisions

Final for Phase 7.0 (product owner, 2 November 2026). Production activation stays gated by legal approval (§4).

| #   | Decision                | Baseline                                                                                                                                                  |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | Problem being solved    | Reduce fraudulent WFH attendance: checking in from an unauthorized location, or someone else checking in. Changed 2 November 2026: evidence is mandatory while a method is on, so it can prevent recording attendance.|
| V2  | Location mode           | Approved area, at check-in and check-out only, read when the photo is taken, no continuous tracking. Without legal approval it stays disabled and isn't replaced by record-only. |
| V3  | Evidence retention      | Raw coordinates never persisted. Selfies deleted automatically after 30 days. Minimum metadata only. Exceptions need a documented legal or investigation requirement. |
| V4  | Failed verification     | Changed 2 November 2026: missing evidence blocks recording. A recorded result doesn't: being outside the area is flagged for Admin/HR to investigate, and is never automatically marked absent, late or fraudulent. |
| V5  | Approved locations      | Employee declares, Admin/HR approves. Changes need approval before becoming active, with an audit history. Managers may recommend, and approve only if explicitly authorized. |
| V6  | Selfie                  | Changed 2 November 2026: required at check-in and check-out. No facial recognition or biometric matching. Review evidence only. Denying the camera means attendance isn't recorded. |
| V7  | Rollout                 | (1) Standard attendance and audit logging. (2) Approved area only if necessary and legally approved. (3) Selfies only if location and existing controls don't address the risk. Each method configured separately per organization, off by default. |
| V8  | Result retention        | 90 days, separately from attendance, then deleted automatically. Audit metadata kept longer only where legally required.                                  |
| V9  | Photo access            | Authorized Admin/HR personnel only, with least privilege. Managers see status and flags but can't view or download photos. Every access audited.          |
| V10 | Declined verification   | Changed 2 November 2026: declining isn't possible while a method is on, because nothing is recorded without evidence. Admin/HR handles anyone who can't comply through a correction. |
| V11 | Low accuracy            | A neutral "Couldn't confirm", never a failure and never flagged on its own, because desktop browsers often locate by network. Attendance is recorded. A retake before using the photo reads the location again; there is no retry afterwards. |
| V12 | Employee's own photo    | No in-app viewer at first. Requests go through an authorized Admin/HR process with an identity check, and requests and disclosures are audit-logged. Photos stay under 30-day retention. Employees are told how to use this right. Legal confirms the procedure (Q15). |

## 9. Recommended order

Follow decision V7. Both methods are built and off by default; building them needed no incidents (product owner, 2 November 2026). Turning one on for an organization is what needs documented justification: location only with evidence from the incident log, and selfies only if location and existing controls don't address the risk. Production stays off until §4.1 is met.

## 10. What was built

- **Backend:** module `attendance-verification` (settings, notice acknowledgement, location, approved areas, selfie, review list, photo access and requests, daily cleanup at 03:15 UTC). New tables `attendance_verifications`, `work_locations`, `verification_notice_acknowledgements`, `verification_photo_requests`; two organization columns; permissions `verification:manage` and `verification:read_photo` for owners and Admin/HR. Audit events `attendance_verification.*`, never with coordinates or results. Unit tests for the distance, accuracy and retry rules; e2e tests for every acceptance criterion above.
- **Frontend:** a check-in panel next to today's card (notice, area request, location, camera), Admin/HR settings at `/settings/verification` (methods with a reason, area approvals, photo requests), results at `/verification` (managers reach it from Team when the deployment allows checks), and the employee's own evidence at `/attendance/verification`.
- **Switches:** `VERIFICATION_ENABLED` in both apps, off by default. `Permissions-Policy` allows `camera=(self)` and `geolocation=(self)` only when it is on.
