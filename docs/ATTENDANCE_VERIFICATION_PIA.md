# Privacy Impact Assessment — Location and Selfie Checks

| Attribute      | Value                                                                               |
| -------------- | ----------------------------------------------------------------------------------- |
| Status         | Not independently reviewed — production gated (plan §4.1)                           |
| Version        | 0.4                                                                                 |
| Date           | 2 November 2026                                                                     |
| Product owner  | Developer                                                                           |
| Legal reviewer | None; external review deferred (plan §4.1, D1)                                      |
| Plan           | [`ATTENDANCE_VERIFICATION_PLAN.md`](ATTENDANCE_VERIFICATION_PLAN.md) §4 (Phase 7.0) |

This is a product team's draft, not legal advice, and no lawyer has reviewed it. The product decisions are in the plan's §8. The features are built but off by default; the legal requirements are reassessed before production activation (plan §4.1).

## 1. Summary

**Baseline:** the product owner has decided the design (plan §8). Both methods stay off by default, and legal approval is required before either is enabled in production.

| Option                  | Decision                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| Location, approved area | Second step, only if necessary and legally approved. If not approved, it stays disabled.                |
| Location, record only   | Rejected. It stores only whether a location was shared, so it verifies nothing.                         |
| Selfie at check-in      | Third step, only if location and existing controls don't address the risk. Highest risk of the options. |

What the reviewer should look at first:

1. **A selfie may legally be biometric data.** The plan excludes face matching, but secondary sources quote the law's elucidation as giving "gambar wajah" (facial images) as an example of biometric data, which is specific personal data. Selfies are treated as specific personal data unless legal says otherwise.
2. **PP 33/2026 applies to this work.** The implementing regulation was promulgated on 16 July 2026 and takes effect on 16 January 2027. It reportedly requires an impact assessment to be finished before high-risk processing begins.
3. **Declining must be free of consequence for consent to work.** Decision V10 makes declining neutral, but Admin/HR can still review it, and the final handling depends on Q3.
4. **Necessity is not yet evidenced.** The purpose is decided (V1), but no incidents are recorded (§3). Decision V7 requires necessity to be shown before each step.

## 2. Scope and roles

**In scope:** one location reading and/or one selfie, captured when an employee presses Check in or Check out, as described in the plan's §5 and §6.

**Out of scope:** tracking, background collection and face matching. Each would need its own assessment.

**People affected:** employees using the app. Selfies can also capture other people at home, including children.

| Role                 | Proposed                                                       | To confirm                                                     |
| -------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| Controller           | The employer organization, which decides to turn a method on   | Yes                                                            |
| Processor            | Whoever operates Hadir.in, if different from the employer      | Yes; a written processing agreement is needed if so (Q9)       |
| Sub-processors       | Object storage, hosting and email providers; Sentry if enabled | Production providers and their regions are not documented (Q8) |
| Data protection lead | Not appointed                                                  | Whether one is mandatory at this scale (Q7)                    |

## 3. Purpose and legal basis

The purpose (decision V1) is to reduce fraudulent WFH attendance, and it covers two problems. Purpose limitation applies: this data can't be reused for anything else.

| Problem                                   | Method                 | Evidence that the problem exists                |
| ----------------------------------------- | ---------------------- | ----------------------------------------------- |
| Checking in from an unauthorized location | Approved-area location | None recorded yet; required before step 2 of V7 |
| Someone else checking in                  | Selfie                 | None recorded yet; required before step 3 of V7 |

Results are not findings of fraud. A flag means a person should look, and neither the app nor a report may label anyone as fraudulent (decision V4).

Law No. 27 of 2022 (UU PDP) Article 20(2) sets out the legal bases. Our preliminary reading of the ones that could apply:

| Basis               | Fit                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Explicit consent    | Weak between employer and employee, particularly if refusal is flagged. It also has to be withdrawable.            |
| Contract            | Uncertain. Attendance can be recorded without a photo or location, which makes necessity hard to argue.            |
| Legitimate interest | Possible for location. PP 33/2026 reportedly requires a documented assessment of necessity, purpose and balancing. |
| Legal obligation    | No obligation identified that requires location or photos.                                                         |

For selfies, one firm reads Article 20(2) as requiring explicit consent for biometric data. The article's text lists consent as one of several bases, so this needs a clear answer (Q2).

## 4. Necessity and less intrusive alternatives

The assessment has to show that nothing less intrusive would do the job.

| Problem                      | Try first                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Checking in for a colleague  | Re-enter the password at check-in, review of active sessions, a stated policy on account sharing |
| Working from the wrong place | A written work-location policy. If employees may work anywhere, location has no purpose          |
| Disputes                     | The existing correction flow and audit log                                                       |
| Low trust in general         | Team check-ins and management practice, not data collection                                      |

Limits apply either way: browser location and camera input can be faked, so these checks deter and support disputes but prove nothing.

## 5. Data collected

| Data                                | Method   | Sensitivity                                                                                            | Proposed handling                                      |
| ----------------------------------- | -------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Latitude, longitude, accuracy       | Location | High: for WFH, this reveals the home address                                                           | Used for the comparison on the server, never persisted |
| Approved home area (centre, radius) | Location | High: long-lived and close to a home address                                                           | Coarsest workable precision; subject to Q4             |
| Result, distance band, accuracy     | Location | Medium: a record of behaviour over time                                                                | 90 days (V8); managers see the label only (V11)        |
| Selfie                              | Selfie   | Possibly specific personal data; may also show health, religious dress, home interior and other people | Private storage, signed links, audited views           |
| Result, upload reference            | Selfie   | Medium                                                                                                 | 90 days (V8)                                           |
| Photo view audit entry              | Selfie   | Low                                                                                                    | Follows the audit retention period                     |

## 6. Retention and access

| Data                 | Decision                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Raw coordinates      | Never persisted (V3).                                                                                           |
| Photos               | Deleted automatically after 30 days. Exceptions need a documented legal or investigation requirement (V3).      |
| Verification results | Deleted automatically after 90 days, separately from attendance records, which stay at five years (V8).         |
| Approved areas       | Proposal: deleted when the employee leaves or the area is replaced. Audit history never holds the centre point. |

| Who                 | Can see                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| The employee        | Their own results. Their own photos only through an access request (V12, Q15)                                            |
| Direct manager      | Status labels and review flags for direct reports; never photos (V9, V11)                                                |
| Authorized Admin/HR | Flags, accuracy diagnostics and photos in their organization, never coordinates; every photo access is audited (V9, V11) |
| Everyone else       | Nothing (404)                                                                                                            |

Retention and access are enforced by the backend, not only in the UI.

**Existing code that must change before a selfie could ship:**

- `backend/src/modules/uploads/uploads.constants.ts` keeps a soft-deleted file for seven more days, so a 30-day photo would really live for 37. Photos are deleted outright.
- The same file allows 10 MB and non-image types. Photos need their own purpose and limits, as the plan's §6.2 says.
- Coordinates and photo links must stay out of logs, audit metadata and Sentry events. The Sentry setup deliberately omits Session Replay, and that has to stay so.
- `frontend/next.config.ts` blocks the camera and location through `Permissions-Policy`. It may only change for a method legal has approved.

## 7. Risks to employees

Likelihood and impact are preliminary judgements, before mitigation.

| Risk                                                     | Likelihood | Impact | Mitigation                                                                             |
| -------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------- |
| Home address or photos exposed in a breach               | Low        | High   | No stored coordinates, coarse areas, private storage, short retention                  |
| A selfie captures a child or other household member      | Medium     | High   | Tell the employee to frame only themselves; short retention; narrow access             |
| A selfie reveals health, religion or home circumstances  | Medium     | Medium | Narrow access, no reuse, no other processing                                           |
| A flag leads to unfair treatment despite "human review"  | Medium     | High   | Neutral wording, no effect on status, a way to respond (decision V4)                   |
| Employees feel unable to refuse                          | High       | Medium | Declining shows a neutral "Not shared" (decision V10), clear notice                    |
| Felt as surveillance; loss of trust                      | High       | Medium | Moment-only capture, notice first, publish what managers can see                       |
| A manager misuses access to look at someone's photos     | Low        | High   | Managers can't open photos; least-privilege permission, audited views (V9)             |
| Scope creep into tracking or face matching               | Low        | High   | Principles in domain rules; any extension needs a new assessment                       |
| Faked data wrongly clears or wrongly flags someone       | Medium     | Medium | Say plainly that results are not proof; no automatic consequence                       |
| Employee without a camera or precise location is flagged | Medium     | Low    | Neutral "Not shared" or "Couldn't confirm"; no flag for low accuracy; retry (V10, V11) |

## 8. Employee rights

UU PDP Articles 5–13 give employees rights including information, correction, access and objection to certain automated decisions. The design needs to support the following:

- **Information:** the notice in §9, available at any time from the app.
- **Access and correction:** employees see their own results, can dispute them through the existing correction flow, and request their own photos from authorized Admin/HR, who verify their identity first. Requests and disclosures are audit-logged (V12).
- **Withdrawal or objection:** a route through Admin/HR, with the effect depending on the legal basis.
- **Deletion:** the retention schedule, plus a route for early deletion of an accidental photo.
- **No automated decisions:** a person reviews each flag, and nothing changes automatically.

**Breach response:** written notice to affected employees and the authority within 3 × 24 hours. Hadir.in has no documented procedure for this yet, and one is needed before launch.

## 9. Draft employee notice

The notice is shown before the first collection. Square brackets are filled in per organization, and the text needs legal review. Only the paragraphs for the approved methods would be used.

> **Attendance checks at [Organization]**
>
> From [date], [Organization] will ask for [your location / a photo] when you check in, to help confirm that attendance is recorded by the right person from your approved work location. Nothing is collected when you check out.
>
> **What is collected.** Location: your position once, when you press the button. It is compared with [your approved area], then discarded. We keep the result and a rough distance. If the reading isn't accurate enough, you'll see "Couldn't confirm". That isn't a failed check and doesn't affect your attendance, and you can try again if you want to. Photo: one photo, taken when you press the button. Please frame only yourself, and keep other people out of it.
>
> **What is not collected.** We never track you between check-ins, and we don't use face recognition.
>
> **Who can see it.** Your direct manager sees only the status and any review flag. Authorized Admin/HR staff can open a photo, and every view is recorded. You can't view photos in the app. To get your own photo, ask [support contact]; we'll confirm your identity before sharing it, and record the request.
>
> **How long it is kept.** Photos: 30 days. Results: 90 days. We keep them longer only if a documented legal or investigation requirement applies.
>
> **How it is used.** Only to verify attendance. It isn't used for productivity or performance scoring, and it doesn't change your attendance status automatically. These checks can be wrong, so a person reviews any flag and you can respond.
>
> **If you can't or don't want to share.** You can still check in, and your attendance is recorded normally. Your record shows "Not shared", which isn't treated as a failed check. [Final wording subject to legal review.]
>
> **Your rights.** You can ask to see or correct this data, or object to it, by contacting [support contact]. [Legal basis and full privacy notice link.]

**Acknowledgement:** the employee presses "I've read this". The app records the notice version and the time. An acknowledgement records that they were told, and isn't consent; if consent is the legal basis, it needs its own explicit step.

## 10. Questions for the legal reviewer

| #   | Question                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Is a stored selfie with no face matching "biometric data" and so specific personal data?                                                                       |
| Q2  | Which legal basis fits each method? Does specific personal data require explicit consent, and is that consent valid from an employee?                          |
| Q3  | Does flagging a refusal to a manager make consent invalid or the processing disproportionate?                                                                  |
| Q4  | May a home area be stored at all, and at what precision? Does repeatedly confirming someone is home change the assessment?                                     |
| Q5  | Are the proposed retention periods acceptable, and how do they interact with employment-record duties?                                                         |
| Q6  | Does Hadir.in meet the high-risk triggers (specific data, systematic monitoring, large scale)? Is this assessment's form sufficient?                           |
| Q7  | Is a data protection officer mandatory at this scale, given Article 53 and Constitutional Court decision 151/PUU-XXII/2024?                                    |
| Q8  | If storage or sub-processors are outside Indonesia, which transfer rules apply?                                                                                |
| Q9  | Who is controller and who is processor, and what must the agreement between them contain?                                                                      |
| Q10 | Does Indonesian labour law or a company regulation require consulting employees or a union before introducing this?                                            |
| Q11 | Must the notice and any consent request be in Bahasa Indonesia? The app is currently in English.                                                               |
| Q12 | Has UU PDP been amended by a 2026 law? One source says so, another implies it is still planned.                                                                |
| Q13 | Who receives breach notices while the PDP Agency isn't confirmed as established?                                                                               |
| Q14 | Does the five-year retention of attendance and audit data, already flagged for legal review before production, hold up?                                        |
| Q15 | Does the access-request procedure (V12) satisfy an employee's right to their own photo? What happens when a request is still open at the 30-day deletion date? |
| Q16 | Are the 30-day and 90-day periods long enough for a dispute or investigation, and what must a documented exception record?                                     |

## 11. Approval

External legal review is deferred: compliance status is "Not independently reviewed". The product owner's decisions close Phase 7.0 and allow development; they don't approve production use. Before verification is enabled in production, the legal requirements are reassessed and the deferred items in the plan's §4.1 are met.

| Role           | Name      | Decision                                  | Date            |
| -------------- | --------- | ----------------------------------------- | --------------- |
| Product owner  | Developer | Product decisions final, V1–V12 (plan §8) | 2 November 2026 |
| Legal reviewer | —         | Deferred (plan §4.1, D1)                  |                 |

## 12. Sources

Checked on 2 November 2026. Article numbers for PP 33/2026 come from a client alert, not the regulation's text, and the elucidation wording on facial images comes from a law firm's article. The reviewer should check all of them against the official texts.

- [UU 27/2022, Pasal.id](https://pasal.id/akn/id/act/uu/2022/27) (Articles 4, 20, 34 and 53, partial text) and [JDIH Komdigi](https://jdih.komdigi.go.id/produk_hukum/view/id/832/t/undangundang%2Bnomor%2B27%2Btahun%2B) (official listing)
- [SIP Law Firm, biometric data](https://siplawfirm.id/id/publikasi/perlindungan-data-biometrik) (facial images, explicit consent)
- [RSM Indonesia, PP 33/2026 alert, 18 September 2026](https://www.rsm.global/indonesia/en/node/439) (dates, DPIA, DPO, breach and processor articles)
- [Rajah & Tann, PP 33/2026 update](https://id.rajahtannasia.com/?p=66928) (legitimate interest, contract, retention records, transfers)
- [DLA Piper, Data Protection in Indonesia](https://www.dlapiperdataprotection.com/?c=ID&t=law) (overview)
- [Conventus Law](https://conventuslaw.com/report/indonesia-personal-data-protection-under-2026-implementing-regulation/) and [Assegaf Hamzah & Partners/HBT, August 2026](https://www.hbtlaw.com/insights/2026-08/indonesia-personal-data-protection-and-cybersecurity-quarterly-update-august-2026) (the conflict in Q12)
- [Rajah & Tann, PDP Agency update](https://www.rajahtannasia.com/?p=188802) (agency status)
