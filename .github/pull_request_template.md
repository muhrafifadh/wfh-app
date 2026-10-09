## What and why

<!-- What changed, and why. Link the issue or the matching frontend PR. -->

<!-- If any of these apply, say so at the top:
⚠️ Schema change (which kind: see docs/playbooks/database-migration.md)
⚠️ API contract change (link the frontend PR)
-->

## Checklist

Full list: [docs/playbooks/pr-checklist.md](https://github.com/muhrafifadh/backend-boilerplate/blob/main/docs/playbooks/pr-checklist.md)

- [ ] Controller → service → repository; no module reads another module's tables
- [ ] Every new route has `@Public()`, `@Authenticated()` or `@RequirePermissions(...)`
- [ ] Records loaded by ID are checked against the caller's organization (404 if not theirs)
- [ ] Strict Zod DTOs for inputs; response DTOs for outputs
- [ ] Services throw `AppError` subclasses with stable codes
- [ ] Multi-row writes use a transaction; no network calls inside it
- [ ] Unit tests for business rules; e2e covers 401 / 403 / other-org 404 / success
- [ ] No secrets or personal data in logs, errors, URLs or job data
- [ ] New env vars in `env.ts` and `.env.example`; new dependencies explained above
- [ ] Docs updated if a rule changed
