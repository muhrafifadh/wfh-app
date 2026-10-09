# 08 · Data Fetching

How to read data. For create/update/delete, see [09 Server Actions](09-server-actions.md).

> API names here target **Next.js 16**. If the pinned version in `package.json` is different, check the Next.js docs.

## The layers

```
page.tsx  ──►  features/<f>/queries.ts  ──►  lib/api/client.ts  ──►  backend
(server)       server-only, cached per       auth, base URL,
               request, parses with Zod      errors, timeouts

Client Component ──► TanStack Query ──► app/api/<f>/route.ts ──► queries.ts
(only when data must change on the client)
```

## Rules

- **Fetch in Server Components by default.** Pages call functions from `queries.ts` directly.
- **All calls to the backend go through `lib/api/client.ts`.** Nothing else calls `fetch` to the backend. (`proxy.ts`'s token refresh is the one exception; it can't use `next/headers`.)
- **Every backend call forwards `X-Forwarded-For`** (`lib/api/forwarded.ts`), so the backend rate-limits per user's IP instead of per Next server. In production, run Next behind a proxy that appends the real client IP.
- **Every query parses its response with Zod.** If the backend changes its response shape, we get a clear error here instead of a crash somewhere deep in the UI.
- **Wrap query functions in React `cache()`.** Then calling the same query from a layout, a page, and `generateMetadata` sends only one request.
- **Run independent requests in parallel** with `Promise.all`, or by putting them in separate `<Suspense>` boundaries. Don't `await` them one after another.
- **Queries return `null` for "not found"** and throw `ApiError` for anything else. The page then calls `notFound()`.
- **Requests are not cached by default; cache only on purpose.** You may cache shared, non-user-specific data with `"use cache"` + `cacheTag()` + `cacheLife()`. **Never cache user-specific data** in a cache that is shared between users.
- **Use TanStack Query only when data must change on the client:** polling, infinite scroll, or data that depends on client-only interaction. TanStack Query calls a route handler in `app/api/`, and that handler reuses the same `queries.ts` function.

## Examples

**The API client** (written once, in `lib/api/client.ts`):

```ts
import "server-only";
import type { z } from "zod";

import { env } from "@/lib/env";
import { getAccessToken } from "@/lib/auth/session";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiFetchOptions<S extends z.ZodType> = RequestInit & { schema: S };

export async function apiFetch<S extends z.ZodType>(
  path: string,
  { schema, headers, ...init }: ApiFetchOptions<S>,
): Promise<z.infer<S>> {
  const token = await getAccessToken();
  const res = await fetch(`${env.API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    signal: init.signal ?? AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new ApiError(`API ${init.method ?? "GET"} ${path} failed`, res.status, body);
  }
  if (res.status === 204) return schema.parse(undefined);
  return schema.parse(await res.json());
}
```

**A feature query:**

```ts
// features/invoices/queries.ts
import "server-only";
import { cache } from "react";

import { apiFetch, ApiError } from "@/lib/api/client";
import { invoiceSchema, invoiceListSchema } from "./schemas";
import type { InvoiceFilters } from "./search-params";

export const getInvoice = cache(async (id: string) => {
  try {
    return await apiFetch(`/invoices/${encodeURIComponent(id)}`, { schema: invoiceSchema });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

export const listInvoices = cache(async (filters: InvoiceFilters) => {
  const params = new URLSearchParams({ page: String(filters.page), q: filters.q });
  if (filters.status) params.set("status", filters.status);
  return apiFetch(`/invoices?${params}`, { schema: invoiceListSchema });
});
```

**Parallel requests:**

```tsx
// ✅ both requests start at the same time
const [invoice, customer] = await Promise.all([getInvoice(id), getCustomer(customerId)]);

// ❌ the second request waits for the first to finish
const invoice = await getInvoice(id);
const customer = await getCustomer(customerId);
```

**Client reads with TanStack Query** (only when needed):

```ts
// features/invoices/query-keys.ts
export const invoiceKeys = {
  all: ["invoices"] as const,
  lists: () => [...invoiceKeys.all, "list"] as const,
  list: (filters: InvoiceFilters) => [...invoiceKeys.lists(), filters] as const,
  detail: (id: string) => [...invoiceKeys.all, "detail", id] as const,
};
```

```ts
// features/invoices/hooks.ts
"use client";
export function useInvoiceActivity(id: string) {
  return useQuery({
    queryKey: [...invoiceKeys.detail(id), "activity"],
    queryFn: () => fetchJson(`/api/invoices/${id}/activity`, activitySchema),
    refetchInterval: 15_000,
  });
}
```

- Every query key comes from the feature's key factory. Never write query keys inline.
- The QueryClient sets `staleTime: 60_000` by default. Override it per query only with a reason.

## Don't

- **Don't fetch in `useEffect`.** It causes request waterfalls and race conditions, and it doesn't cache or deduplicate.
- **Don't have the app call its own route handlers from a Server Component.** It adds an extra network hop for no reason. Call `queries.ts` directly.
- **Don't call the backend straight from the browser.** The auth token lives in an httpOnly cookie, so browser code can't read it. Go through a route handler or a Server Action.
- **Don't use TanStack Query for data the server already rendered** "just in case". Server Components already give you the data.
- **Don't return backend objects to the client as they are.** Return only the fields the UI needs ([05](05-server-client-boundary.md)).

## Related

[09 Server Actions](09-server-actions.md) · [11 State & URL params](11-state-and-url-params.md) · [13 Error handling](13-error-handling.md)
