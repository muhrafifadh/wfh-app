# Hadir.in — Product Documentation

Product and design documentation for Hadir.in, a Work From Home attendance management system. The application code lives in two separate repositories next to this folder:

- [`backend-boilerplate/`](backend-boilerplate/) — NestJS API
- [`frontend-boilerplate/`](frontend-boilerplate/) — Next.js web app

Both are ignored by this repository and keep their own history.

## Commit rules

- Write commit messages in Conventional Commits style, e.g. `docs(plans): mark phase 1 complete`.
- Never credit Claude, Anthropic, or another AI tool as a co-author: no `Co-Authored-By: Claude …` trailer and no "Generated with Claude Code" line. The app repos enforce this with the commitlint rule `no-ai-co-author`.
- Push only with explicit approval.
