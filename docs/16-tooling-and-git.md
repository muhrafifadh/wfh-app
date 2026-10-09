# 16 · Tooling & Git

## Toolchain

| Tool                    | Rule                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node**                | The version pinned in `.nvmrc` and `package.json#engines`.                                                                                                                                        |
| **pnpm**                | The only package manager. Commit `pnpm-lock.yaml`.                                                                                                                                                |
| **Docker Compose**      | Runs local Postgres (dev + test) and Redis: `docker compose up -d`.                                                                                                                               |
| **TypeScript**          | `strict`; `pnpm typecheck` must pass with zero errors.                                                                                                                                            |
| **oxlint**              | Type-aware (`--type-aware`). Project rules in `.oxlintrc.json`: no `any`, no `!`, no `console`, `no-floating-promises`, no `process.env` outside `config/`, no `../` imports, no default exports. |
| **Prettier**            | Plus `@ianvs/prettier-plugin-sort-imports`, which sorts imports. Formatting is never discussed in reviews.                                                                                        |
| **Husky + lint-staged** | Pre-commit: oxlint + Prettier on staged files.                                                                                                                                                    |
| **commitlint**          | Checks every commit message against Conventional Commits.                                                                                                                                         |

The project is **ESM**: relative and `@/` imports end in `.js` (`@/config/env.js`). The `@/` alias is rewritten to relative paths by `nest build`, and resolved by Vite in tests (`resolve.tsconfigPaths`).

Docker Compose ports are set in `.env` (`POSTGRES_PORT`, `POSTGRES_TEST_PORT`, `REDIS_PORT`). Change them if another project already uses the defaults.

## First-time setup

```bash
nvm use
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The API runs on `http://localhost:8000/v1`. Swagger is at `http://localhost:8000/docs`.

## Scripts

```bash
pnpm dev            # nest start --watch
pnpm build          # nest build
pnpm start:prod     # node dist/main
pnpm lint           # oxlint --type-aware
pnpm format         # prettier --write
pnpm typecheck      # tsc --noEmit
pnpm test           # unit tests
pnpm test:e2e       # migrate + e2e tests against postgres-test
pnpm db:migrate     # prisma migrate dev
pnpm db:deploy      # prisma migrate deploy (CI / prod)
pnpm db:seed        # prisma db seed
pnpm db:studio      # prisma studio
```

## CI

Every PR must pass all of these before it can be merged:

1. `pnpm lint` and `pnpm typecheck`
2. `pnpm test`
3. `prisma migrate diff` to check that the schema and migrations match (no missing migration)
4. `pnpm test:e2e` against a Postgres service container
5. `pnpm build`
6. `pnpm audit --prod` (high or critical issues block the merge)

## Deployment

- A multi-stage `Dockerfile` builds the image. The final image contains production dependencies only and runs as a non-root user.
- Releases run `prisma migrate deploy` as a separate step **before** the new version starts.
- The app reads all config from env vars ([11](11-configuration.md)), so the same image runs in every environment.

## Suppressing a check

- Every `oxlint-disable-next-line <rule>` has a comment explaining why.
- Use `@ts-expect-error` with an explanation. Never use `@ts-ignore`.

## Git workflow

Same conventions as `frontend-boilerplate`:

- **Branches:** `<type>/<short-kebab-description>` from `main`: `feat/invoice-void`, `fix/refresh-token-reuse`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/), e.g. `feat(invoices): add void endpoint`. Imperative mood, lowercase, no period, under 72 characters. Use `feat!:` or a `BREAKING CHANGE:` footer for API contract breaks.
- **PRs:**
  - Keep them small (aim for under ~400 changed lines) and use the PR template.
  - **Schema changes and API contract changes are called out at the top of the description.**
  - A PR needs 1 approval and passing CI. Merge with **squash**. The author merges after approval and deletes the branch.

## Don't

- **Don't force-push to `main`**, and never commit directly to it.
- **Don't commit `.env`, `dist/`, `coverage/`, `src/generated/`, or `node_modules/`.**
- **Don't skip hooks with `--no-verify`.**
- **Don't combine a schema migration and a large refactor in one PR.**

## Related

[14 Testing](14-testing.md) · [Playbook: PR checklist](playbooks/pr-checklist.md)
