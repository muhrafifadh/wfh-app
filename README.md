# Hadir.in

Hadir.in, a Work From Home attendance management system. One repository holds both apps and the product documentation:

- [`backend/`](backend/) — NestJS API
- [`frontend/`](frontend/) — Next.js web app
- The product and design documents below, at the root

Each app keeps its own `package.json`, lockfile and checks. CI runs per app ([`.github/workflows/`](.github/workflows/)); the Git hooks in [`.husky/`](.husky/) lint staged files in whichever app they belong to. The apps' earlier history (from `backend-boilerplate` and `frontend-boilerplate`) is merged in, so `git log -- backend` shows it.

## Running Hadir.in locally

1. In `backend/`: follow its README (Docker Compose project `hadirin`, `.env`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`). The API runs on http://localhost:8000, with Swagger at `/docs`.
2. In `frontend/`: follow its README (`.env.local`, `pnpm dev`). Sign in with a demo account listed there.

Each README covers environment variables, demo accounts, the role and permission matrix, tests and known limitations. The attendance rules are [`DOMAIN_RULES.md`](DOMAIN_RULES.md); the implementation status and review evidence per phase are in [`PLANS.md`](PLANS.md).

## Commit rules

- Write commit messages in Conventional Commits style, e.g. `docs(plans): mark phase 1 complete`.
- Never credit Claude, Anthropic, or another AI tool as a co-author: no `Co-Authored-By: Claude …` trailer and no "Generated with Claude Code" line. The `commit-msg` hook enforces this with the commitlint rule `no-ai-co-author`.
- Push only with explicit approval.
