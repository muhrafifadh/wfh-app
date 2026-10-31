# 02 · Naming & Imports

## Naming rules

| Thing                       | Convention                               | Example                                |
| --------------------------- | ---------------------------------------- | -------------------------------------- |
| Files & folders             | `kebab-case`                             | `invoice-table.tsx`, `use-debounce.ts` |
| Components                  | `PascalCase`, named the same as the file | `invoice-table.tsx` → `InvoiceTable`   |
| Hooks                       | `use` + `camelCase`                      | `useDebounce`                          |
| Functions, variables        | `camelCase`                              | `formatCurrency`                       |
| Module-level constants      | `SCREAMING_SNAKE_CASE`                   | `MAX_UPLOAD_BYTES`                     |
| Types                       | `PascalCase`, no `I` / `T` prefix        | `Invoice`, `InvoiceStatus`             |
| Props types                 | component name + `Props`                 | `InvoiceTableProps`                    |
| Zod schemas                 | `camelCase` + `Schema`                   | `createInvoiceSchema`                  |
| Types inferred from schemas | `PascalCase`, no suffix                  | `type CreateInvoiceInput = z.infer<…>` |
| Server Actions              | verb + noun + `Action`                   | `createInvoiceAction`                  |
| Server reads                | `get` / `list` + noun                    | `getInvoice`, `listInvoices`           |
| Booleans                    | `is` / `has` / `can` / `should`          | `isOpen`, `canEdit`                    |
| Callback props              | `on` + event                             | `onSelect`                             |
| Handlers inside a component | `handle` + event                         | `handleSelect`                         |
| Zustand stores              | `use` + noun + `Store`                   | `useSidebarStore`                      |
| Unit/component tests        | `<file>.test.ts(x)`, next to the file    | `format-currency.test.ts`              |
| E2E tests                   | `e2e/<flow>.spec.ts`                     | `e2e/create-invoice.spec.ts`           |

## Rules

- **One exported component per file.** Small private helper components in the same file are fine.
- **Use named exports everywhere.** Use default exports only for files where Next.js requires them: `page`, `layout`, `loading`, `error`, `not-found`, `template`, `default`, `global-error`.
- **Names describe the domain, not the implementation.** `InvoiceStatusBadge`, not `GreenRedPill`.
- **Avoid abbreviations.** `customer`, not `cust`. Common ones are fine: `id`, `url`, `api`, `props`, `ref`.

## Imports

- Use the `@/` alias for anything under `src/`. Relative imports are only allowed for the same folder or a child folder (`./invoice-row`). **Never write `../`.**
- Import order is enforced by ESLint, with a blank line between groups:
  1. `react`, `next/*`
  2. external packages
  3. `@/` internal modules
  4. relative (`./`)
  5. styles
- Use `import type { X }` when you import only types.
- Import shadcn primitives from their own files (`@/components/ui/button`), never through a barrel file.

```tsx
import { Suspense } from "react";
import Link from "next/link";

import { z } from "zod";

import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/session";
import type { Invoice } from "@/features/invoices/types";

import { InvoiceRow } from "./invoice-row";
```

## Don't

- **Don't write `export default function Component()` outside Next.js special files.** People who import it can rename it however they like, which makes it hard to search for.
- **Don't add prefixes like `IUser` or `TProps`.** They add noise without adding information.
- **Don't use generic file names** like `utils.ts`, `helpers.ts`, `misc.ts` inside features. Name the file after what it contains.

## Related

[01 Project structure](01-project-structure.md) · [18 Tooling & Git](18-tooling-and-git.md)
