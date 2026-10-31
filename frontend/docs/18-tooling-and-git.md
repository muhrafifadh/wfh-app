# 18 · Tooling & Git

## Toolchain

| Tool                    | Rule                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node**                | The version pinned in `.nvmrc` and `package.json#engines`. Run `nvm use`.                                                                                     |
| **pnpm**                | The only package manager. Commit `pnpm-lock.yaml`. Don't commit `package-lock.json` or `yarn.lock`.                                                           |
| **TypeScript**          | `strict`. `pnpm typecheck` must pass with zero errors.                                                                                                        |
| **ESLint**              | `next/core-web-vitals`, `next/typescript`, `jsx-a11y`, import order, plus the project rules (no `any`, no `process.env`, no `console.log`, no `../` imports). |
| **Prettier**            | Plus `prettier-plugin-tailwindcss`. Formatting is never discussed in reviews.                                                                                 |
| **Husky + lint-staged** | Pre-commit runs ESLint and Prettier on staged files.                                                                                                          |
| **commitlint**          | Checks every commit message against Conventional Commits.                                                                                                     |

## Scripts

```bash
pnpm dev          # start dev server
pnpm build        # production build
pnpm start        # run the production build
pnpm lint         # eslint
pnpm format       # prettier --write
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest
pnpm test:e2e     # playwright
pnpm api:types    # regenerate API types from the backend's openapi.json
pnpm analyze      # bundle analyzer
```

## CI

Every PR must pass all of these before it can be merged:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test` (with coverage of the changed files)
4. `pnpm build`
5. `pnpm test:e2e` on the critical flows, with axe checks ([15](15-accessibility.md))

## Suppressing a check

- Every `eslint-disable-next-line <rule>` has a comment explaining why. Never disable a rule for a whole file without the team agreeing.
- Use `@ts-expect-error` with an explanation. Never use `@ts-ignore`.
- When you see one of these in review, ask whether it's really needed.

## Git workflow

### Branches

`<type>/<short-kebab-description>`, branched from `main`:

```
feat/invoice-filters
fix/login-redirect-loop
chore/upgrade-next
refactor/extract-api-client
docs/auth-rules
```

### Commits

[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): subject`

```
feat(invoices): add status filter to invoice list
fix(auth): validate next param to prevent open redirect
refactor(api): extract ApiError handling into client
docs: add server actions rules
```

- Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `style`, `chore`, `build`, `ci`.
- Write the subject in the imperative mood ("add", not "added"), in lowercase, with no period, under 72 characters.
- Write a commit body when the _why_ isn't obvious.
- **No AI co-authors:** Commit messages and PR descriptions must not credit Claude, Anthropic, or another AI tool as a co-author (no `Co-Authored-By: Claude …` trailer, no "Generated with Claude Code" line). commitlint rejects a Claude/Anthropic `Co-Authored-By` trailer (`no-ai-co-author`).
- `feat!:` or a `BREAKING CHANGE:` footer marks a breaking change.

### Pull requests

- **Keep PRs small:** aim for under ~400 changed lines. Split big work into PRs that can be merged one after another.
- **Use the PR template.** It contains the [PR checklist](playbooks/pr-checklist.md).
- **The description says what changed and why**, and includes screenshots or a recording for any UI change (light _and_ dark).
- **A PR needs 1 approval and passing CI.** Merge with **squash**. The squash commit message follows Conventional Commits.
- **The author merges their own PR** after approval, and deletes the branch.

## Don't

- **Don't force-push to `main`**, and never commit directly to it.
- **Don't commit secrets, `.env*.local`, `.next/`, `coverage/`, or `node_modules/`.** If you commit a secret by accident, rotate it right away. Deleting it from Git history is not enough.
- **Don't write "WIP" or "fix stuff" commit messages** on `main`. Squash them before merging.
- **Don't skip hooks with `--no-verify`.**

## Related

[14 Testing](14-testing.md) · [PR checklist](playbooks/pr-checklist.md)
