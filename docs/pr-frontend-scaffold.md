chore: scaffold Next.js app with tooling that enforces the docs

## What

Scaffolds the app described in `docs/` and sets up tooling so the rules are enforced automatically. This PR is the scaffold only. Auth, CI and other features come in later PRs.

- **Stack:** Next.js 16.4, React 19.3, Tailwind CSS v4, shadcn/ui (Radix, Nova preset).
- **TypeScript:** `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`.
- **ESLint:** `next/core-web-vitals`, `next/typescript`, the full `jsx-a11y` recommended set, and project rules mapped to the docs:
  - no `any`, no `!`, no `@ts-ignore`
  - type-only imports and import order
  - no `../` imports
  - no `process.env` outside `lib/env.ts`
  - no `console.log`, no `<img>`
- **Formatting and hooks:** Prettier with the Tailwind plugin; Husky, lint-staged and commitlint (Conventional Commits).
- **Tests:** Vitest with Testing Library.
- **App code:**
  - `lib/env.ts`: env vars validated at build and startup.
  - `app/providers.tsx`: theme, React Query, nuqs, toaster.
  - Root error, global-error and 404 pages; a skip link.
  - `ActionResult`, `reportError`, `EmptyState`, `Paginated<T>`, and `config/` (site, routes, constants).
- **Docs:** updated for the versions that were actually installed (see below). Prettier also reformatted the markdown tables.

## Checks (all passing locally)

| Check | Result |
|---|---|
| `pnpm lint` | ✅ 0 problems |
| `pnpm typecheck` (`next typegen && tsc --noEmit`) | ✅ |
| `pnpm test` | ✅ 2 tests |
| `pnpm format:check` | ✅ |
| `pnpm build` | ✅ |
| `pnpm start` | ✅ `/` renders the heading and skip link; unknown routes return 404 |

## Deliberate lint-rule check

I linted a throwaway file containing a `../` import, `any`, `console.log`, `process.env`, a non-null assertion, `@ts-ignore`, `<img>` without `alt`, and `onClick` on a `<div>`. ESLint reported **10 errors, one for every violation**. The file was deleted and isn't in this PR.

## Version-specific changes

- **Next.js 16.4:** `cacheComponents` is on by default. The generated `AGENTS.md` is kept, and `CLAUDE.md` now points to it and to the docs bundled in `node_modules/next/dist/docs/`.
- **Error pages receive `retry`, not `reset`**, in Next.js 16.4. `error.tsx` and `global-error.tsx` use `retry`, and `docs/13-error-handling.md` is updated to match.
- **shadcn now ships its own [`cn`](https://github.com/shadcn-ui/cn) package** instead of `clsx` + `tailwind-merge`. `lib/utils.ts` re-exports it, and `docs/07-styling-and-theming.md` is updated.
- **`API_URL` includes `/v1`**, to match the backend's global prefix.

## Secrets

- `.env.local` is gitignored and not committed.
- `.env.example` contains placeholder values only.
- `SKIP_ENV_VALIDATION=1` lets builds run without real values (for Docker or lint-only CI jobs).

## Follow-ups (not in this PR)

- **Auth:** `lib/api/client.ts`, `lib/auth/session.ts`, `proxy.ts`, the login page and action, token refresh, `useCurrentUser()`.
- **CI:** GitHub Actions running lint, typecheck, test, build, and Playwright with axe checks.
- **Bundle analyzer:** the `pnpm analyze` script described in `docs/16-performance.md`.
- **Dockerfile** for deployment.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
