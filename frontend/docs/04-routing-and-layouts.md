# 04 · Routing & Layouts

## Rules

- **Pages only fetch and arrange.** A `page.tsx` reads params, calls queries, and renders feature components. Aim for under ~60 lines.
- **Every segment that fetches data has a `loading.tsx` and an `error.tsx`.** If only one section of a page is slow, wrap that section in `<Suspense>` instead.
- **Call `notFound()` for missing resources.** Don't render "not found" text inside a page.
- **`params` and `searchParams` are Promises.** `await` them. Parse `searchParams` with the feature's nuqs loader ([11](11-state-and-url-params.md)), never by hand.
- **Every page exports `metadata` or `generateMetadata`.** At least set `title`. The root layout defines the title template.
- **Use `<Link>` for internal navigation.** Use `<a>` only for external links, and give those `rel="noopener noreferrer"` when they open in a new tab.
- **To redirect, call `redirect()` on the server.** Use `router.push()` only for navigation the user triggers in a Client Component.
- **Layouts don't fetch page-specific data.** Layouts persist across navigation and don't re-render, so they would show stale data. Fetch it in the page.
- **Route handlers (`app/api/**`) are only for:** webhooks, third-party callbacks, file downloads, and client-side reads that TanStack Query needs ([08](08-data-fetching.md)). Mutations go through Server Actions.

## Example: a thin page

```tsx
// src/app/(app)/invoices/[id]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { InvoiceDetail } from "@/features/invoices/components/invoice-detail";
import { getInvoice } from "@/features/invoices/queries";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const invoice = await getInvoice(id);
  return { title: invoice ? `Invoice ${invoice.number}` : "Invoice not found" };
}

export default async function InvoicePage({ params }: PageProps) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  return <InvoiceDetail invoice={invoice} />;
}
```

`getInvoice` is wrapped in React `cache()`, so calling it from both `generateMetadata` and the page only sends one request. See [08](08-data-fetching.md).

## Special files

| File               | Purpose                                   | Notes                                                      |
| ------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| `layout.tsx`       | Shared UI that persists across navigation | Don't fetch page-specific data here                        |
| `page.tsx`         | The route's UI                            | Default export, async Server Component                     |
| `loading.tsx`      | Suspense fallback for the segment         | Use a skeleton shaped like the real content, not a spinner |
| `error.tsx`        | Error boundary for the segment            | Must be `"use client"`; see [13](13-error-handling.md)     |
| `not-found.tsx`    | UI shown when `notFound()` is called      | Define one at the root, and per section if needed          |
| `global-error.tsx` | Catches errors in the root layout         | Renders its own `<html>` / `<body>`                        |
| `route.ts`         | Route handler                             | See the limits above                                       |

## Don't

- **Don't put `"use client"` on a page or layout.** It turns everything below it into client code. See [05](05-server-client-boundary.md).
- **Don't fetch in `useEffect` on page load.** Fetch in the Server Component.
- **Don't use a full-page spinner as the loading state.** Skeletons stop the layout from jumping around when content arrives.
- **Don't build URLs by concatenating strings throughout the code.** Put route builders in `config/routes.ts` (`routes.invoice(id)`).

## Related

[05 Server/client boundary](05-server-client-boundary.md) · [12 Authentication](12-authentication.md) · [13 Error handling](13-error-handling.md)
