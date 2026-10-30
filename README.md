# Hadir.in — Product Documentation

Product and design documentation for Hadir.in, a Work From Home attendance management system. The application code lives in two separate repositories next to this folder:

- [`backend-boilerplate/`](backend-boilerplate/) — NestJS API
- [`frontend-boilerplate/`](frontend-boilerplate/) — Next.js web app

Both are ignored by this repository and keep their own history.

## Running Hadir.in locally

1. In `backend-boilerplate/`: follow its README (Docker Compose project `hadirin`, `.env`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`). The API runs on http://localhost:8000, with Swagger at `/docs`.
2. In `frontend-boilerplate/`: follow its README (`.env.local`, `pnpm dev`). Sign in with a demo account listed there.

Each README covers environment variables, demo accounts, the role and permission matrix, tests and known limitations. The attendance rules are [`DOMAIN_RULES.md`](DOMAIN_RULES.md); the implementation status and review evidence per phase are in [`PLANS.md`](PLANS.md).

## Commit rules

- Write commit messages in Conventional Commits style, e.g. `docs(plans): mark phase 1 complete`.
- Never credit Claude, Anthropic, or another AI tool as a co-author: no `Co-Authored-By: Claude …` trailer and no "Generated with Claude Code" line. The app repos enforce this with the commitlint rule `no-ai-co-author`.
- Push only with explicit approval.
