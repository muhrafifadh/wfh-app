# Playbook · PR Checklist

Go through this list before you request a review. Reviewers check the same list.

## Structure

- [ ] Files are in the right place ([01](../01-project-structure.md)) and follow the naming rules ([02](../02-naming-and-code-style.md)).
- [ ] Controller → service → repository each do only their own job ([03](../03-modules-and-layers.md)). No module reads another module's tables.
- [ ] No `any`, unexplained `!`, or `@ts-ignore` ([04](../04-typescript.md)).

## API

- [ ] Endpoints follow the URL, status code, and pagination conventions ([05](../05-api-design.md)).
- [ ] Every input has a strict Zod DTO. Every response has a response DTO ([06](../06-validation-and-dtos.md)).
- [ ] Swagger docs are complete (tags, summaries, error responses).
- [ ] **If the contract changed:** `pnpm openapi` was run and `openapi.json` committed; the description says so, and links the frontend PR (which regenerates its types).

## Security

- [ ] Every new route has `@RequirePermissions`, or a `@Public()` with a reason ([09](../09-authorization.md)).
- [ ] Records loaded by ID are checked against the caller's organization (404 if they don't match).
- [ ] No secrets, tokens, or personal data in logs, errors, URLs, or job data ([12](../12-logging-and-observability.md), [13](../13-security.md)).
- [ ] New env vars are in `env.ts` and `.env.example` ([11](../11-configuration.md)).

## Data

- [ ] Writes that have to happen together use a transaction. No network calls inside it ([07](../07-database-and-prisma.md)).
- [ ] No N+1 queries. Every list has `take` and a stable `orderBy`.
- [ ] **If the schema changed:** the [migration playbook](database-migration.md) was followed, and the description starts with "⚠️ Schema change".
- [ ] Background jobs can safely run more than once and are enqueued after the commit ([15](../15-background-jobs.md)).

## Errors

- [ ] Services throw `AppError` subclasses with stable codes ([10](../10-error-handling.md)).
- [ ] No empty `catch` blocks, and no `console.*`.

## Quality

- [ ] Unit tests for the business rules. E2E tests cover the authorization matrix and validation ([14](../14-testing.md)).
- [ ] A bug fix includes a test that fails without the fix.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm build` pass.
- [ ] Any new dependency is explained in the description.

## PR itself

- [ ] Title follows Conventional Commits.
- [ ] The description explains what changed and why.
- [ ] The diff is under ~400 lines, or there's a reason it can't be split.
- [ ] If this PR changes a rule, the docs are updated in the same PR.
