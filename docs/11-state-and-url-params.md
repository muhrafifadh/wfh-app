# 11 · State & URL Params

## Choosing where state lives

Go down this list and use the first option that fits:

| # | Kind of state | Where it lives |
|---|---|---|
| 1 | Can it be computed from other values? | **Compute it during render.** Don't store it |
| 2 | Server data | Server Components; TanStack Query on the client ([08](08-data-fetching.md)) |
| 3 | Should survive a refresh or a shared link (filters, search, tabs, pagination, sort, open item) | **URL search params** via `nuqs` |
| 4 | Used by one component | `useState` / `useReducer` |
| 5 | Shared within one subtree | Lift it to the nearest common parent; if that doesn't work, use React Context scoped to that subtree |
| 6 | Truly global client state (sidebar collapsed, cart, command palette) | **Zustand** store in `src/stores/` |

## Rules

- **Server data stays where it was fetched.** Never copy it into `useState`, Context, or Zustand. That creates a second copy that goes stale.
- **List state goes in the URL**, so filters, search, sort, and pagination work with the back button and can be shared.
- **Each feature defines its URL params once**, in `features/<f>/search-params.ts`. The page and its client components both import from that file.
- **Zustand stores are small and named after one concern** (`useSidebarStore`, not `useAppStore`). Components select the fields they need with selectors.
- **Use Context for dependency injection** within a subtree (e.g. "the current invoice" inside an editor). Don't use it as a general-purpose global store.

## Lists & filters

This is the standard pattern for any list page.

**1. Define the params once:**

```ts
// features/invoices/search-params.ts
import { createLoader, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs/server";

import { INVOICE_STATUSES } from "./constants";

export const invoiceSearchParams = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(INVOICE_STATUSES),
  page: parseAsInteger.withDefault(1),
};

export const loadInvoiceSearchParams = createLoader(invoiceSearchParams);
export type InvoiceFilters = Awaited<ReturnType<typeof loadInvoiceSearchParams>>;
```

**2. Read them on the server** and pass the result to the query:

```tsx
// app/(app)/invoices/page.tsx
type PageProps = { searchParams: Promise<SearchParams> };

export default async function InvoicesPage({ searchParams }: PageProps) {
  const filters = await loadInvoiceSearchParams(searchParams);

  return (
    <>
      <InvoiceFilters />                                   {/* client island */}
      <Suspense key={JSON.stringify(filters)} fallback={<InvoiceTableSkeleton />}>
        <InvoiceTable filters={filters} />                 {/* server, calls listInvoices */}
      </Suspense>
    </>
  );
}
```

**3. Update them on the client:**

```tsx
"use client";

export function InvoiceFilters() {
  const [filters, setFilters] = useQueryStates(invoiceSearchParams, { shallow: false });
  // shallow: false makes the server render the page again with the new params

  return (
    <SearchInput
      defaultValue={filters.q}
      onDebouncedChange={(q) => setFilters({ q: q || null, page: 1 })}
    />
  );
}
```

**List rules:**

- **Pagination, filtering, and sorting happen on the server.** Never load the full dataset into the client to filter it.
- **Changing any filter resets `page` to 1.**
- **Debounce search input** (300 ms). Don't add a history entry for each keystroke (nuqs default `history: "replace"`).
- **Have two different empty states:** "No invoices yet" + a create button, versus "No results match your filters" + a clear-filters button.
- **Default values don't appear in the URL** (`clearOnDefault` is on by default), so URLs stay clean.
- **Use a fixed page size** (`config/constants.ts`) unless the user can choose one.

## Zustand example

```ts
// src/stores/sidebar-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

type SidebarState = { isCollapsed: boolean; toggle: () => void };

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({ isCollapsed: false, toggle: () => set((s) => ({ isCollapsed: !s.isCollapsed })) }),
    { name: "sidebar" },
  ),
);

// in a component: select only the field you use
const isCollapsed = useSidebarStore((s) => s.isCollapsed);
```

## Don't

- **Don't use `useEffect` to keep two pieces of state in sync.** Derive one from the other, or move the state up.
- **Don't keep filters in `useState`.** Refreshing the page loses them, and they can't be shared as a link.
- **Don't call `useSidebarStore()` without a selector.** The component then re-renders on every change in the store.
- **Don't parse `searchParams` by hand** (`Number(searchParams.page)`). Use the parsers.

## Related

[08 Data fetching](08-data-fetching.md) · [06 Components](06-components.md)
