# Quick Reference

A one-page summary of the rules. Each line links to the doc that explains it.

## Where does it go?

| I'm writing… | Put it in |
|---|---|
| A page, layout, loading or error state | `src/app/<route>/` → [04](04-routing-and-layouts.md) |
| A component used by one route only | `src/app/<route>/_components/` |
| A component used by one feature | `src/features/<feature>/components/` |
| A component used by 2+ features | `src/components/shared/` |
| A shadcn primitive | `src/components/ui/` (via the CLI) → [06](06-components.md) |
| A server-side data read | `src/features/<feature>/queries.ts` → [08](08-data-fetching.md) |
| A mutation | `src/features/<feature>/actions.ts` → [09](09-server-actions.md) |
| A Zod schema | `src/features/<feature>/schemas.ts` → [10](10-validation-and-forms.md) |
| A type used across features | `src/types/` → [03](03-typescript.md) |
| A framework-agnostic helper | `src/lib/` |
| Global client state | `src/stores/` (Zustand) → [11](11-state-and-url-params.md) |
| An env var | `src/lib/env.ts` + `.env.example` → [17](17-environment-and-config.md) |

## Which tool for what?

| Need | Use |
|---|---|
| Server data on page load | Server Component + `queries.ts` |
| Server data that changes on the client (polling, infinite scroll) | TanStack Query |
| Create / update / delete | Server Action returning `ActionResult` |
| Filters, search, tabs, pagination | URL params via `nuqs` |
| Local UI state | `useState` / `useReducer` |
| Global client state (rare) | Zustand |
| Forms | React Hook Form + Zod + shadcn `<Form>` |
| Class names | `cn()`; variants with `cva` |
| Toasts | `sonner` (`toast.success`, `toast.error`) |
| Current user (server) | `await requireUser()` → [12](12-authentication.md) |
| Current user (client) | `useCurrentUser()` |

## Ten rules people break most

1. Adding `"use client"` to a page or layout. Put it on the smallest interactive component instead. → [05](05-server-client-boundary.md)
2. Calling `fetch` to the backend directly. Always go through `lib/api`. → [08](08-data-fetching.md)
3. A Server Action that doesn't check auth or validate its input. → [09](09-server-actions.md)
4. Validating a form only on the client. → [10](10-validation-and-forms.md)
5. Hard-coding colors (`text-gray-500`, `bg-[#123]`). Use tokens. → [07](07-styling-and-theming.md)
6. Copying server data into `useState` or Zustand. → [11](11-state-and-url-params.md)
7. Storing filters or pagination in `useState` instead of the URL. → [11](11-state-and-url-params.md)
8. `any`, `!`, `@ts-ignore`. → [03](03-typescript.md)
9. Putting `onClick` on a `<div>`. → [15](15-accessibility.md)
10. Reading `process.env` outside `lib/env.ts`. → [17](17-environment-and-config.md)

## Before you push

```bash
pnpm lint && pnpm typecheck && pnpm test
```

Then go through the [PR checklist](playbooks/pr-checklist.md).
