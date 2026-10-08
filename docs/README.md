# Frontend Docs

Rules and conventions for this boilerplate: **Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui**.

New here? Read [quick-reference.md](quick-reference.md) first. When you work on something specific, open the topic file it needs.

## Topics

| # | Doc | Read it when you… |
|---|---|---|
| 01 | [Project structure](01-project-structure.md) | add a file and aren't sure where it goes |
| 02 | [Naming & imports](02-naming-and-imports.md) | name a file, component, hook, or type |
| 03 | [TypeScript](03-typescript.md) | write types or handle data from outside the code |
| 04 | [Routing & layouts](04-routing-and-layouts.md) | add a page, layout, or route segment |
| 05 | [Server/client boundary](05-server-client-boundary.md) | think about adding `"use client"` |
| 06 | [Components](06-components.md) | write or change a component, or add a shadcn primitive |
| 07 | [Styling & theming](07-styling-and-theming.md) | write classes, add variants, or add a design token |
| 08 | [Data fetching](08-data-fetching.md) | read data from the backend |
| 09 | [Server Actions](09-server-actions.md) | change data (create, update, delete) |
| 10 | [Validation & forms](10-validation-and-forms.md) | build a form or write a Zod schema |
| 11 | [State & URL params](11-state-and-url-params.md) | add state, filters, search, or pagination |
| 12 | [Authentication](12-authentication.md) | protect a page or action, or read the current user |
| 13 | [Error handling](13-error-handling.md) | handle failures, empty states, or 404s |
| 14 | [Testing](14-testing.md) | write tests |
| 15 | [Accessibility](15-accessibility.md) | build anything interactive |
| 16 | [Performance](16-performance.md) | add images, fonts, heavy libraries, or dependencies |
| 17 | [Environment & config](17-environment-and-config.md) | add an env var or app-wide constant |
| 18 | [Tooling & Git](18-tooling-and-git.md) | set up locally, commit, or open a PR |

## Playbooks

Step-by-step guides for common tasks:

- [New feature](playbooks/new-feature.md): build a feature module from scratch
- [PR checklist](playbooks/pr-checklist.md): check these before asking for review

## How these docs are written

Every topic doc has the same layout:

1. **Rules**: what you must do. Rules are short and can be checked.
2. **Examples**: the pattern we want, in code.
3. **Don't**: anti-patterns for this topic, each with the reason it's banned.
4. **Related**: links to other docs.

Each rule is written in exactly **one** doc. Other docs link to it instead of repeating it. That way, the copies can't get out of sync.

## Changing a rule

Rules can change, but only on purpose:

1. Open a PR that edits the doc, with `docs:` in the commit message. Explain why the rule should change.
2. In the same PR, update the code (and lint config) that the old rule affected, or open an issue to track it.
3. If a rule can be enforced by a tool (ESLint, TypeScript, CI), enforce it there and link to that config from the doc.
