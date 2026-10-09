# frontend-boilerplate

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · shadcn/ui.

Talks to [`backend-boilerplate`](https://github.com/muhrafifadh/backend-boilerplate) (NestJS) for data and auth.

## Quick start

Requires Node 24 (`nvm use`), pnpm (`corepack enable`), and the backend running on `http://localhost:8000`.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000 and sign in with the backend's seed user (`pnpm db:seed` in the backend; the password is `SEED_ADMIN_PASSWORD` in the backend's `.env`).

## Scripts

| Command                     | What it does                    |
| --------------------------- | ------------------------------- |
| `pnpm dev`                  | Dev server                      |
| `pnpm build` / `pnpm start` | Production build / serve it     |
| `pnpm lint`                 | ESLint (rules map to `docs/`)   |
| `pnpm typecheck`            | `next typegen` + `tsc --noEmit` |
| `pnpm test`                 | Vitest                          |
| `pnpm format`               | Prettier                        |

CI runs format, lint, typecheck, test, build and a production dependency audit on every PR.

## How it's organized

- `src/app`: routes only. `(auth)` holds the login page, `(app)` the signed-in area.
- `src/features/<feature>`: domain code (components, actions, schemas, queries).
- `src/lib/api`: the only backend client (`apiFetch`).
- `src/lib/auth`: session cookies, `requireUser()`, token refresh (used by `src/proxy.ts`).

## Docs

The rules live in [`docs/`](docs/README.md). Start with [`docs/quick-reference.md`](docs/quick-reference.md). AI agents: see [`CLAUDE.md`](CLAUDE.md).
