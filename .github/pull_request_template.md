## What and why

<!-- What changed, and why. Link the issue. -->

<!-- If any of these apply, say so at the top:
⚠️ Schema change (which kind: see backend/docs/playbooks/database-migration.md)
⚠️ API contract change (`pnpm openapi` in backend/, `pnpm api:types` in frontend/)
-->

## Screenshots

<!-- UI changes: light and dark, and at 360px wide. Delete if not UI. -->

## Checklist

Full lists: [backend](../blob/main/backend/docs/playbooks/pr-checklist.md) · [frontend](../blob/main/frontend/docs/playbooks/pr-checklist.md)

**Backend**

- [ ] Controller → service → repository; no module reads another module's tables
- [ ] Every new route has `@Public()`, `@Authenticated()` or `@RequirePermissions(...)`
- [ ] Records loaded by ID are checked against the caller's organization (404 if not theirs)
- [ ] Strict Zod DTOs for inputs; `@ZodResponse` for outputs; `pnpm openapi` run if the API changed
- [ ] Services throw `AppError` subclasses with stable codes
- [ ] Multi-row writes use a transaction; no network calls inside it
- [ ] Unit tests for business rules; e2e covers 401 / 403 / other-org 404 / success
- [ ] No secrets or personal data in logs, errors, URLs or job data

**Frontend**

- [ ] Server Components by default; `"use client"` only on small interactive parts
- [ ] Backend calls go through `lib/api`; no fetching in `useEffect`; new API schemas have a `contract.ts` check
- [ ] New Server Actions check auth, validate with the shared Zod schema, return `ActionResult`
- [ ] Theme tokens only; works in light and dark mode and at 360px
- [ ] Loading, empty and error states handled; usable with only the keyboard

**Both**

- [ ] Tests added or updated, and the app's checks pass
- [ ] New env vars in `env.ts` and `.env.example`; new dependencies explained above
- [ ] Docs updated if a rule changed
