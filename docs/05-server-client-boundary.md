# 05 · Server / Client Boundary

Every file is either server code or client code. Mistakes here cause leaked secrets, oversized bundles, and hydration errors.

## Rules

- **Server Components are the default.** Add `"use client"` only when the component needs at least one of:
  - state or effects (`useState`, `useEffect`, `useReducer`)
  - event handlers (`onClick`, `onChange`, …)
  - browser APIs (`window`, `localStorage`, `IntersectionObserver`)
  - a library that only works on the client
- **Put `"use client"` on the smallest component possible.** Make the interactive part a small "island" and keep everything around it on the server.
- **Pass server-rendered content into client components as `children`** or other slot props, instead of importing server code into them.
- **Props sent from server to client must be serializable:** plain objects, arrays, strings, numbers, booleans, `null`. Pass dates as ISO strings. Server Actions are the only functions you can pass.
- **Mark server-only modules** with `import "server-only"` at the top. This is required for everything in `lib/api/`, `lib/auth/`, and every `queries.ts`. If one of them is ever imported into client code, the build fails.
- **Mark browser-only modules** (code that touches `window` when imported) with `import "client-only"`.
- **There is one providers file:** `app/providers.tsx` (`"use client"`), rendered once in the root layout. It contains the theme, QueryClient, and toaster. Feature-specific providers wrap only the subtree that needs them.

## Examples

**An island inside a server-rendered page:**

```tsx
// features/invoices/components/invoice-detail.tsx (Server Component)
export function InvoiceDetail({ invoice }: { invoice: Invoice }) {
  return (
    <article>
      <h1>{invoice.number}</h1>
      <InvoiceLines lines={invoice.lines} />              {/* server */}
      <MarkAsPaidButton invoiceId={invoice.id} />         {/* client island */}
    </article>
  );
}
```

```tsx
// features/invoices/components/mark-as-paid-button.tsx
"use client";

export function MarkAsPaidButton({ invoiceId }: { invoiceId: string }) {
  const [isPending, startTransition] = useTransition();
  // …calls markInvoicePaidAction
}
```

**Passing server content into a client wrapper as `children`:**

```tsx
// ✅ Collapsible is a client component; <InvoiceLines> still renders on the server
<Collapsible title="Line items">
  <InvoiceLines lines={invoice.lines} />
</Collapsible>
```

## Hydration rules

- The first render must produce the same HTML on server and client. Don't render `Date.now()`, `Math.random()`, `window.*`, or the user's locale or time zone during the first render.
- To show content that only exists on the client (e.g. a relative time like "3 minutes ago", a theme-dependent icon), render a placeholder first and swap it in after mount. Use `suppressHydrationWarning` only on a single element with an unavoidable mismatch, such as a timestamp.

## Don't

- **Don't put `"use client"` on a page, layout, or large container** "to get it working". Find the specific part that needs to be interactive and make only that a client component.
- **Don't import `lib/api` or `lib/auth` into a client component.** It's a security bug, and `server-only` will fail the build.
- **Don't pass a whole database or API object to a client component.** Send only the fields it renders. Everything you pass ends up in the HTML the browser receives.
- **Don't create a `useIsClient` hook to hide hydration bugs.** Fix the mismatch itself.

## Related

[04 Routing & layouts](04-routing-and-layouts.md) · [06 Components](06-components.md) · [12 Authentication](12-authentication.md)
