# Playbook · New Feature

Steps for adding a domain feature (e.g. `invoices`) from scratch. Do them in order, because each step builds on the one before. Skip steps the feature doesn't need.

## 1. Plan

- [ ] Name the feature with a plural `kebab-case` noun: `invoices`, `team-members`.
- [ ] List the routes it needs (list, detail, new, edit), and who is allowed to use each one.
- [ ] Confirm the backend endpoints and response shapes.

## 2. Types & schemas — `features/<f>/schemas.ts`

- [ ] Response schemas (`invoiceSchema`, `invoiceListSchema`) and their inferred types.
- [ ] Input schemas for each mutation (`createInvoiceSchema`, `updateInvoiceSchema`).
- [ ] Constants used by unions (statuses, types) in `constants.ts`, with `as const`.
- [ ] Unit tests for every custom validation rule.

→ [03 TypeScript](../03-typescript.md) · [10 Validation & forms](../10-validation-and-forms.md)

## 3. Permissions — `src/types/auth.ts`

- [ ] Add the feature's permissions (`invoice:read`, `invoice:create`, …) to the `Permission` union.

→ [12 Authentication](../12-authentication.md)

## 4. Reads — `features/<f>/queries.ts`

- [ ] `import "server-only"`.
- [ ] `get<Entity>(id)` returns `null` on 404. `list<Entities>(filters)` returns `Paginated<T>`.
- [ ] Each function is wrapped in `cache()`, and its response is parsed with a schema.

→ [08 Data fetching](../08-data-fetching.md)

## 5. URL state — `features/<f>/search-params.ts` _(list pages)_

- [ ] nuqs parsers + `createLoader`, exporting the `<Entity>Filters` type.

→ [11 State & URL params](../11-state-and-url-params.md)

## 6. Mutations — `features/<f>/actions.ts`

- [ ] `"use server"`. One action per operation, named `<verb><Entity>Action`.
- [ ] Each action: auth → validate → backend → revalidate → `ActionResult` / `redirect`.
- [ ] Tests for each action: unauthenticated, invalid input, success.

→ [09 Server Actions](../09-server-actions.md)

## 7. Components — `features/<f>/components/`

- [ ] Server Components for display (`invoice-table.tsx`, `invoice-detail.tsx`).
- [ ] Small client islands for interactive parts (`invoice-filters.tsx`, `create-invoice-form.tsx`).
- [ ] Loading skeleton, empty states (no data / no results), and error state.
- [ ] Destructive actions ask for confirmation in an `<AlertDialog>`.

→ [05 Server/client boundary](../05-server-client-boundary.md) · [06 Components](../06-components.md) · [13 Error handling](../13-error-handling.md)

## 8. Routes — `app/(app)/<f>/`

- [ ] `page.tsx` (thin), `loading.tsx`, `error.tsx`, plus `[id]/page.tsx`, `new/page.tsx` as needed.
- [ ] `requireUser()` plus a permission check in each page.
- [ ] `metadata` / `generateMetadata` on each page.
- [ ] Add route builders to `config/routes.ts`, and a nav entry (with its required permission) to `config/nav.ts`.

→ [04 Routing & layouts](../04-routing-and-layouts.md)

## 9. Verify

- [ ] An E2E test of the main create/edit/delete flow, with an axe check.
- [ ] Use it with only the keyboard. Check it at 360px wide. Check it in light and dark mode.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- [ ] Go through the [PR checklist](pr-checklist.md).

## Resulting layout

```
src/features/invoices/
├── components/
│   ├── invoice-table.tsx
│   ├── invoice-table-skeleton.tsx
│   ├── invoice-filters.tsx
│   ├── invoice-detail.tsx
│   ├── invoice-status-badge.tsx
│   └── create-invoice-form.tsx
├── actions.ts
├── actions.test.ts
├── constants.ts
├── queries.ts
├── schemas.ts
├── schemas.test.ts
└── search-params.ts

src/app/(app)/invoices/
├── page.tsx
├── loading.tsx
├── error.tsx
├── new/page.tsx
└── [id]/page.tsx
```
