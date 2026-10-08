# CLAUDE.md

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui boilerplate.

The rules live in [`docs/`](docs/README.md). **Before you write or review code, read [`docs/quick-reference.md`](docs/quick-reference.md), then the topic docs for the task:**

| Task | Read |
|---|---|
| Adding a whole feature | `docs/playbooks/new-feature.md` |
| Adding a page / route | `docs/04-routing-and-layouts.md`, `docs/05-server-client-boundary.md` |
| Writing a component | `docs/06-components.md`, `docs/07-styling-and-theming.md`, `docs/15-accessibility.md` |
| Reading backend data | `docs/08-data-fetching.md` |
| Mutations | `docs/09-server-actions.md`, `docs/10-validation-and-forms.md` |
| Forms | `docs/10-validation-and-forms.md` |
| Lists, filters, pagination, any state | `docs/11-state-and-url-params.md` |
| Auth, permissions, current user | `docs/12-authentication.md` |
| Errors, empty states, 404 | `docs/13-error-handling.md` |
| Tests | `docs/14-testing.md` |
| Env vars or constants | `docs/17-environment-and-config.md` |
| Commits / PRs | `docs/18-tooling-and-git.md`, `docs/playbooks/pr-checklist.md` |

## Never break these

- Server Components by default. `"use client"` only on the smallest interactive part.
- Every Server Action: `requireUser()` → Zod validation → backend → revalidate → `ActionResult`.
- Backend calls only go through `lib/api/client.ts`. Never fetch in `useEffect`.
- No `any`, `@ts-ignore`, hard-coded colors, `process.env` outside `lib/env.ts`, or `../` imports.
- Filters and pagination live in the URL (nuqs), not in `useState`.

## Before saying a task is done

```bash
pnpm lint && pnpm typecheck && pnpm test
```

If a rule seems wrong for the task, say so. Don't quietly break it. Rule changes go through the docs ([docs/README.md](docs/README.md#changing-a-rule)).
