# 13 · Error Handling

## Two kinds of failure

| | Expected | Unexpected |
|---|---|---|
| Examples | Validation failed, not found, no permission, conflict | Backend down, bug, bad response shape |
| How it's reported | A return value: `ActionResult`, a query returning `null` | `throw` |
| Shown by | The component that made the request (inline, toast, `notFound()`) | The nearest `error.tsx` |
| Logged? | No | Yes, reported to the error tracker |

## Rules

- **Expected failures are part of the return type.** Actions return `ActionResult` ([09](09-server-actions.md)). Queries return `null` for missing data ([08](08-data-fetching.md)).
- **Unexpected failures throw and go to `error.tsx`.** Don't catch an error unless you can do something useful with it.
- **Every route group has an `error.tsx`.** The root has `global-error.tsx` for errors thrown by the root layout itself.
- **Users never see raw error messages, status codes, or stack traces.** Show a friendly message and a way to recover (retry, go back, contact support).
- **Report unexpected errors** to the error tracker, from `error.tsx` and from server code (`lib/logger.ts`). Include the `digest`, so a server error can be matched to the error the user saw.
- **A missing resource calls `notFound()`.** A missing permission shows a "you don't have access" state, or calls `forbidden()` if that's enabled.
- **Use toasts for the result of an action**: "Invoice deleted", or an error that doesn't belong to a field. Use inline messages for field errors and for errors loading a section.

## `error.tsx` template

```tsx
// app/(app)/error.tsx
"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/logger";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <div role="alert" className="grid place-items-center gap-4 py-16 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground text-sm">Please try again. If it keeps happening, contact support.</p>
      {error.digest && <p className="text-muted-foreground text-xs">Reference: {error.digest}</p>}
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

## Errors in one section of a page

If a non-critical section fails (e.g. a "recent activity" sidebar), the rest of the page should still work. Wrap that section in its own `<Suspense>` and an error boundary, so the failure only affects that section.

## The UI state checklist

Every component that loads data must handle all of these states:

| State | What to render |
|---|---|
| Loading | A skeleton shaped like the content |
| Empty (no data yet) | `<EmptyState>` with an explanation and the main action |
| Empty (filters match nothing) | "No results" + a clear-filters button |
| Error | A message + a retry button |
| Partial / stale | Old data stays visible, with a subtle refreshing indicator |
| Success | The content |

## Don't

- **Don't write `catch (e) { console.log(e) }`.** Catching an error and only logging it hides failures. Either handle the error or let it reach the boundary.
- **Don't show `error.message` to users.** It may reveal internal details.
- **Don't wrap whole components in `try/catch` "to be safe".** Use the error boundaries.
- **Don't treat "not found" as unexpected** (throwing a generic error for a 404). Call `notFound()`.
- **Don't leave `console.log` in committed code.** Use `lib/logger.ts`. ESLint blocks `console` except `warn` and `error`.

## Related

[09 Server Actions](09-server-actions.md) · [04 Routing & layouts](04-routing-and-layouts.md) · [08 Data fetching](08-data-fetching.md)
