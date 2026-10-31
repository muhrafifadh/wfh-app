## What and why

<!-- What changed, and why. Link the issue or the matching backend PR. -->

## Screenshots

<!-- UI changes: light and dark, and at 360px wide. Delete if not UI. -->

## Checklist

Full list: [docs/playbooks/pr-checklist.md](https://github.com/muhrafifadh/frontend-boilerplate/blob/main/docs/playbooks/pr-checklist.md)

- [ ] Server Components by default; `"use client"` only on small interactive parts
- [ ] Backend calls go through `lib/api`; no fetching in `useEffect`; new API schemas have a `contract.ts` check
- [ ] New Server Actions check auth, validate with the shared Zod schema, return `ActionResult`
- [ ] Theme tokens only; works in light and dark mode and at 360px
- [ ] Loading, empty and error states handled; usable with only the keyboard
- [ ] Tests added or updated; `pnpm lint && pnpm typecheck && pnpm test` pass
- [ ] New env vars in `lib/env.ts` and `.env.example`; new dependencies explained above
- [ ] Docs updated if a rule changed
