# CLAUDE.md

One repository: [`backend/`](backend/), [`frontend/`](frontend/) and product documents in [`docs/`](docs/). Each app has its own `CLAUDE.md` with the rules for working in it.

## Commit rules

- Write commit messages in Conventional Commits style, e.g. `docs(plans): mark phase 1 complete`.
- Never credit Claude, Anthropic, or another AI tool as a co-author: no `Co-Authored-By: Claude …` trailer and no "Generated with Claude Code" line. The `commit-msg` hook enforces this with the commitlint rule `no-ai-co-author`.
- Push only with explicit approval.
