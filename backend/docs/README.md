# Backend Docs

Rules and conventions for this boilerplate: **NestJS · TypeScript · PostgreSQL · Prisma · JWT auth**.

New here? Read [quick-reference.md](quick-reference.md) first. When you work on something specific, open the topic file it needs.

> The web app is [`frontend/`](../../frontend) (Next.js), in the same repository. The [API contract](05-api-design.md) is what the two apps agree on. If you change it, update both in the same PR.

## Topics

| #   | Doc                                                        | Read it when you…                                        |
| --- | ---------------------------------------------------------- | -------------------------------------------------------- |
| 01  | [Project structure](01-project-structure.md)               | add a file and aren't sure where it goes                 |
| 02  | [Naming & code style](02-naming-and-code-style.md)         | name a file, class, method, or DTO                       |
| 03  | [Modules & layers](03-modules-and-layers.md)               | write a controller, service, or repository               |
| 04  | [TypeScript](04-typescript.md)                             | write types or handle data from outside the code         |
| 05  | [API design](05-api-design.md)                             | add or change an endpoint                                |
| 06  | [Validation & DTOs](06-validation-and-dtos.md)             | accept input or shape a response                         |
| 07  | [Database & Prisma](07-database-and-prisma.md)             | change the schema, write a query, or use a transaction   |
| 08  | [Authentication](08-authentication.md)                     | touch login, tokens, or sessions                         |
| 09  | [Authorization](09-authorization.md)                       | protect an endpoint or check ownership                   |
| 10  | [Error handling](10-error-handling.md)                     | throw, catch, or return an error                         |
| 11  | [Configuration](11-configuration.md)                       | add an env var or a config value                         |
| 12  | [Logging & observability](12-logging-and-observability.md) | log something, or add health checks or metrics           |
| 13  | [Security](13-security.md)                                 | handle user input, files, secrets, or outgoing requests  |
| 14  | [Testing](14-testing.md)                                   | write tests                                              |
| 15  | [Background jobs](15-background-jobs.md)                   | do work outside the request (emails, retries, schedules) |
| 16  | [Tooling & Git](16-tooling-and-git.md)                     | set up locally, commit, or open a PR                     |
| 17  | [File uploads](17-file-uploads.md)                         | accept files from users                                  |

## Playbooks

- [New module](playbooks/new-module.md): build a domain module from scratch
- [Database migration](playbooks/database-migration.md): change the schema safely
- [PR checklist](playbooks/pr-checklist.md): check these before asking for review

## How these docs are written

Every topic doc has the same layout:

1. **Rules**: what you must do. Rules are short and can be checked.
2. **Examples**: the pattern we want, in code.
3. **Don't**: anti-patterns for this topic, each with the reason it's banned.
4. **Related**: links to other docs.

Each rule is written in exactly **one** doc. Other docs link to it instead of repeating it. That way, the copies can't get out of sync.

## Changing a rule

1. Open a PR that edits the doc, with `docs:` in the commit message. Explain why the rule should change.
2. In the same PR, update the code (and lint config) that the old rule affected, or open an issue to track it.
3. If the change affects the API contract, update `frontend/` in the same PR.
4. If a rule can be enforced by a tool (oxlint, TypeScript, CI), enforce it there and link to that config from the doc.
