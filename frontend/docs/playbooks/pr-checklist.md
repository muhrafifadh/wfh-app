# Playbook · PR Checklist

Go through this list before you request a review. Reviewers check the same list.

## Structure & code

- [ ] Files are where [01](../01-project-structure.md) says they go. No feature imports from another feature.
- [ ] Names follow [02](../02-naming-and-imports.md). There are no `../` imports.
- [ ] No `any`, unexplained `!`, or `@ts-ignore`. Data from outside the code is parsed with Zod ([03](../03-typescript.md)).

## Server / client

- [ ] Components run on the server by default. `"use client"` is only on small interactive parts ([05](../05-server-client-boundary.md)).
- [ ] Client components receive only the fields they need. Nothing server-only is imported into the client.

## Data & security

- [ ] Reads go through `queries.ts` → `lib/api`. Nothing fetches in `useEffect` ([08](../08-data-fetching.md)).
- [ ] Every new Server Action checks auth and permissions, validates its input, revalidates, and returns `ActionResult` ([09](../09-server-actions.md)).
- [ ] The form and the action use the same schema ([10](../10-validation-and-forms.md)).
- [ ] No secrets in client code or in `NEXT_PUBLIC_*` variables. New env vars are added to `env.ts` and `.env.example` ([17](../17-environment-and-config.md)).

## UI

- [ ] Uses theme tokens only. Checked in **light and dark** mode ([07](../07-styling-and-theming.md)).
- [ ] Works at 360px wide.
- [ ] Loading, empty, and error states are all handled ([13](../13-error-handling.md)).
- [ ] Filters and pagination live in the URL ([11](../11-state-and-url-params.md)).
- [ ] Usable with only the keyboard. Labels, alt text, and focus states are all present ([15](../15-accessibility.md)).
- [ ] Images use `next/image`. Heavy components are loaded lazily ([16](../16-performance.md)).

## Quality

- [ ] Tests added or updated. A bug fix includes a test that fails without the fix ([14](../14-testing.md)).
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass.
- [ ] No `console.log`, commented-out code, or `it.only`.
- [ ] Any new dependency is explained in the description.

## PR itself

- [ ] Title follows Conventional Commits.
- [ ] The description explains what changed and why, and includes screenshots or a recording for UI changes.
- [ ] The diff is under ~400 lines, or there's a reason it can't be split.
- [ ] If this PR changes a rule, the docs are updated in the same PR ([README](../README.md#changing-a-rule)).
