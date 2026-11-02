# Attendance Verification Plan — Location and Selfie Checks

| Attribute     | Value                                                                 |
| ------------- | --------------------------------------------------------------------- |
| Status        | Phase 7.0 product decisions final — production gated by legal approval |
| Version       | 0.4                                                                   |
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

1. **Moment only, never tracking.** Location or a photo is captured once, at the moment of check-in, and only when the employee presses the button. The one repeat is a location retry that the employee starts after a low-accuracy result (decision V11). No background or automatic repeated collection.
2. **Purpose-limited.** Used only to verify that attendance action. Never for productivity, performance scoring, or anything else.
3. **Off by default.** Each method is configured separately per organization and stays off until approved; nothing changes for organizations that don't turn one on.
4. **Told first.** Employees see a notice explaining what is collected, why, who can see it and for how long, before the first collection. The privacy copy in `UX_FLOWS.md` §21 is rewritten to match.
5. **Flag, don't punish.** A failed or missing check never blocks attendance or changes its status automatically. It is flagged for Admin/HR to review (decision V4), and nobody is automatically marked absent, late or fraudulent. Declining is neutral (decision V10).
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

**Production gate:** the legal reviewer has to approve the assessment before location or selfie verification is enabled in production. Code may ship with both methods off, but only after each phase passes its step in decision V7. Until legal approves, the promises in `DOMAIN_RULES.md` §15, `UX_FLOWS.md` §21 and PRD §4 still describe what happens, and `Permissions-Policy` keeps blocking the camera and location.

## 5. Phase 7A — Location at check-in

### 5.1 Behaviour

1. The organization turns on location checks. The only mode is approved area (decision V2): compare the location with the employee's approved work-from-home area and store the result. If legal doesn't approve it, location verification stays disabled; it isn't replaced with record-only.
2. When the employee presses Check in, the browser asks for location once (the Geolocation API with a short timeout). The button stays usable while it waits.
3. The client sends latitude, longitude and accuracy with the check-in request. The server still decides the time; the location is only evidence.
4. The server computes the result and stores it apart from the attendance record:
   - `verified`, `outside_approved_area`, `low_accuracy` (accuracy worse than a threshold, for example 500 m), `not_shared` (denied, unavailable or timed out).
5. Attendance is recorded normally whatever the result. `outside_approved_area` is flagged for review. `not_shared` is shown as a neutral "Not shared", never as failed or outside (decision V10). `low_accuracy` is shown as a neutral "Couldn't confirm", isn't a failure, and is never flagged on its own (decision V11).
6. Raw coordinates are never persisted (decision V3): only the result, the distance rounded to a band (for example under 1 km, 1–10 km, over 10 km) and the accuracy.
7. Verification results are deleted automatically after 90 days; the attendance record is unaffected (decision V8).
8. After a `low_accuracy` result the employee can choose to retry on the same work date. A retry takes one new reading, replaces the result, and never changes the attendance record or its check-in time (decision V11).
9. Managers see only the status label. Authorized Admin/HR can also see accuracy diagnostics when necessary, never raw coordinates (decision V11).

### 5.2 Approved areas

- An area is a centre point and a radius (for example 1 km), per employee.
- The employee declares their area and Admin/HR approves it. Changes are requested the same way and only become active once approved. Managers may recommend a change but can't approve one unless explicitly authorized (decision V5).
- Every request, approval and change is in the audit history, which records who, when and the outcome, never the centre point.
- Storing an employee's home area is the most sensitive part of this phase; legal review in 7.0 decides whether it is allowed and at what precision.

### 5.3 Changes by layer

- **Data model:** `AttendanceVerification` (its own table referencing the attendance record; method `location`, result, accuracy in metres, distance band, server time captured, deletion date), `WorkLocation` (organization, optional employee, label, centre, radius, status, effective dates), and verification settings on the organization (each method on/off, off by default; accuracy threshold).
- **API:** check-in accepts an optional `location { latitude, longitude, accuracyMeters }` (strict Zod; rejected when the organization hasn't turned location on), plus an endpoint for the employee's own retry, accepted only after `low_accuracy`. Responses for managers leave out accuracy and distance band, enforced by the backend. New endpoints to manage work locations and verification settings (`policy:manage`). Team and organization views gain a verification flag and filter. OpenAPI regenerated.
- **Permissions:** viewing status and flags follows existing scopes (`attendance:read_team`, `attendance:read_all`); approving areas uses `policy:manage`. Enabling a method also requires a deployment-level switch, off by default, so it can't be turned on in production from the settings page alone.
- **Frontend:** location request on the today card, with clear states (asking, verified, not shared, couldn't confirm with a retry button) and a link to the privacy notice; a flag badge in team, record and report views; an Admin/HR settings page; `Permissions-Policy` allows `geolocation=(self)` only after legal approval (only when the organization has it on, if feasible, otherwise for the app's own origin).
- **Domain rules:** a new section for verification results, the accuracy threshold, the distance bands and the "never blocks attendance" rule.
- **Audit:** settings changes, area requests and approvals. The result stays out of check-in event metadata, because audit is kept for five years and results for 90 days (decision V8).

### 5.4 Acceptance criteria

- With location off, nothing changes: no permission prompt, no new fields accepted.
- With it on, each check-in stores exactly one result and check-out collects nothing; denying permission records attendance normally with `not_shared`, which is not flagged as failed.
- `low_accuracy` creates no review flag; a retry replaces the result and leaves the attendance record unchanged; a retry after any other result is refused.
- Manager responses contain the status label only; Admin/HR diagnostics never contain coordinates.
- Results at the edge of an area and at the accuracy threshold match the domain rule (unit tests on the distance calculation).
- Raw coordinates are never stored and never appear in logs, audit metadata, exports or API responses.
- The cleanup job deletes results after 90 days and leaves the attendance record unchanged (e2e with the fixed clock).
- A change to an approved area has no effect until Admin/HR approves it; a manager without explicit authorization gets a refusal.
- Managers see status and flags only for their direct reports (negative tests).

## 6. Phase 7B — Selfie at check-in

### 6.1 Behaviour

1. The organization turns on selfie checks, which apply at check-in only (decision V6). Decision V7 sets when this phase may start.
2. Pressing Check in opens the camera (`getUserMedia`) in the browser; the employee takes one photo and can retake it. Uploading a file from the gallery is not offered.
3. The photo is uploaded through the existing presigned upload flow (`uploads` module) to private object storage, then attached to the check-in request by upload ID. The server checks the upload belongs to the caller, is an image, and was created moments before.
4. Attendance is recorded normally whatever happens with the photo. A missing photo shows as a neutral "Not shared" (decision V10). Selfies are review evidence only.
5. Authorized Admin/HR personnel can view the photo through a short-lived signed URL, and each view is audited. Direct managers see status and flags, and can't view or download photos (decision V9).
6. Photos are deleted automatically after 30 days. An exception needs a documented legal or investigation requirement (decision V3).
7. There is no in-app photo viewer in the initial implementation, including for the employee. An employee can request their own photos through an authorized Admin/HR process. Admin/HR verifies the requester's identity before disclosing anything, and both the request and the disclosure are audit-logged (decision V12).

### 6.2 Changes by layer

- **Data model:** `AttendanceVerification` with method `selfie`, result (`captured`, `not_captured`), upload reference; a retention date per photo, stored apart from the attendance record.
- **Uploads:** a new upload purpose for attendance photos, smaller size limit (for example 2 MB, JPEG/WebP), stricter key prefix, and a cleanup job for expired photos that deletes the file outright, skipping the seven-day soft-delete window other uploads get.
- **API:** check-in accepts an optional `selfieUploadId`; a `GET` for a photo's signed URL, audited and limited to a new least-privilege permission (for example `verification:read_photo`) that is granted separately from `attendance:read_all`.
- **Frontend:** camera capture dialog with retake, upload progress, failure states that don't block check-in, and a photo viewer for reviewers. `Permissions-Policy` allows `camera=(self)` only after legal approval.
- **Domain rules and audit:** as for location; audit records each photo view (who viewed whose photo, when) and each access request and disclosure. Photos and results are never included in attendance exports.

### 6.3 Not in this phase: face matching

Comparing the selfie with a reference face would process biometric data: the strictest category, with vendor, accuracy, bias and liveness problems. It is out of scope; it would need its own assessment and decision.

### 6.4 Acceptance criteria

- With selfies off, the camera is never requested.
- A photo from another user, another organization, a non-image or an old upload is rejected.
- Only Admin/HR personnel holding the photo permission can open a photo; every open is in the audit log; everyone else, including direct managers, gets 404.
- Photos are deleted after 30 days unless a documented exception is recorded (e2e with the fixed clock).
- Denying camera access still allows check-in, with a neutral "Not shared" and no failed flag.
- An employee has no in-app route to a photo; a disclosure can't be recorded without an identity check, and the request and disclosure are both in the audit log.

## 7. Risks

| Risk                                          | Mitigation                                                                  |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| Treated as surveillance; trust drops          | Moment-only capture, notice first, flags instead of penalties, short retention. |
| Spoofed location or photo                     | Documented as a deterrent; human review of flags; no automatic penalties.  |
| Home locations or photos leak                 | Store results not raw data; private bucket; short retention; audited access. |
| Employees without a camera, or who refuse     | Never blocks attendance; HR handles flags case by case.                    |
| Scope creep into tracking or face recognition | Principles in domain rules; any extension needs a new decision.            |

## 8. Product decisions

Final for Phase 7.0 (product owner, 2 November 2026). Production activation stays gated by legal approval (§4).

| #   | Decision                | Baseline                                                                                                                                                  |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | Problem being solved    | Reduce fraudulent WFH attendance: checking in from an unauthorized location, or someone else checking in. Must stay lightweight and privacy-conscious, and never prevent legitimate attendance. |
| V2  | Location mode           | Approved area, at check-in only, no continuous tracking. Without legal approval it stays disabled and isn't replaced by record-only.                       |
| V3  | Evidence retention      | Raw coordinates never persisted. Selfies deleted automatically after 30 days. Minimum metadata only. Exceptions need a documented legal or investigation requirement. |
| V4  | Failed verification     | Never blocks attendance. Flagged for Admin/HR to investigate. Never automatically marked absent, late or fraudulent.                                      |
| V5  | Approved locations      | Employee declares, Admin/HR approves. Changes need approval before becoming active, with an audit history. Managers may recommend, and approve only if explicitly authorized. |
| V6  | Selfie                  | Check-in only. No facial recognition or biometric matching. Review evidence only. Denying the camera doesn't block attendance.                            |
| V7  | Rollout                 | (1) Standard attendance and audit logging. (2) Approved area only if necessary and legally approved. (3) Selfies only if location and existing controls don't address the risk. Each method configured separately per organization, off by default. |
| V8  | Result retention        | 90 days, separately from attendance, then deleted automatically. Audit metadata kept longer only where legally required.                                  |
| V9  | Photo access            | Authorized Admin/HR personnel only, with least privilege. Managers see status and flags but can't view or download photos. Every access audited.          |
| V10 | Declined verification   | A neutral "Not shared", never failed or outside. Attendance stays valid with no automatic penalty. Admin/HR can review where appropriate. Final handling subject to legal approval. |
| V11 | Low accuracy            | A neutral "Couldn't confirm", never a failure and never flagged on its own, because desktop browsers often locate by network. Attendance is unaffected, and the employee may retry. The backend separates `verified`, `outside_approved_area`, `low_accuracy` and `not_shared`. Managers see the label; Admin/HR may see accuracy diagnostics, never coordinates. |
| V12 | Employee's own photo    | No in-app viewer at first. Requests go through an authorized Admin/HR process with an identity check, and requests and disclosures are audit-logged. Photos stay under 30-day retention. Employees are told how to use this right. Legal confirms the procedure (Q15). |

## 9. Recommended order

Follow decision V7. Phase 7.0 closes on the decisions above, and step 1 is already live. Phase 7A starts only with evidence that location checks are needed, and Phase 7B only if location and existing controls don't address the risk. Legal approval is required before either is enabled in production.
