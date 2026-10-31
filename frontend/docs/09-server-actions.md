# 09 · Server Actions

Every mutation the UI triggers (create, update, delete) is a Server Action in `features/<feature>/actions.ts`.

## Rules

Every action does these five steps, **in this order**:

1. **Authenticate and authorize** with `requireUser()` / `can()`. A Server Action is a public HTTP endpoint: anyone can call it directly, even if the button that triggers it is hidden. See [12](12-authentication.md).
2. **Validate the input** with the feature's Zod schema. Treat the input as `unknown` even though it has a type, because callers can send anything.
3. **Call the backend** through `lib/api/client.ts`.
4. **Revalidate** whatever the change affects: `revalidatePath()`, or `updateTag()` for tagged caches.
5. **Return an `ActionResult`.** Don't throw for expected failures.

More rules:

- **Expected failures return `{ ok: false }`:** validation errors, conflicts, permission denied, not found. **Unexpected failures throw**, and the nearest `error.tsx` handles them ([13](13-error-handling.md)).
- **Error messages are written for users.** Never return raw backend messages or stack traces.
- **After a successful create, redirect on the server** with `redirect()`, called _outside_ any `try/catch` because `redirect` works by throwing.
- **One action does one thing.** Don't build `saveInvoiceAction({ mode })` actions that branch on a mode.

## The `ActionResult` type

```ts
// src/lib/actions.ts
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string, fieldErrors?: Record<string, string[] | undefined>) =>
  ({ ok: false, error, fieldErrors }) as const;
```

## Example

```ts
// features/invoices/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { apiFetch, ApiError } from "@/lib/api/client";
import { fail, type ActionResult } from "@/lib/actions";
import { requireUser, can } from "@/lib/auth/session";
import { createInvoiceSchema, invoiceSchema } from "./schemas";

export async function createInvoiceAction(input: unknown): Promise<ActionResult<never>> {
  // 1. auth
  const user = await requireUser();
  if (!can(user, "invoice:create")) return fail("You don't have permission to create invoices.");

  // 2. validate
  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors);
  }

  // 3. call backend
  let invoiceId: string;
  try {
    const invoice = await apiFetch("/invoices", {
      method: "POST",
      body: JSON.stringify(parsed.data),
      schema: invoiceSchema,
    });
    invoiceId = invoice.id;
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return fail("An invoice with this number already exists.", { number: ["Already in use"] });
    }
    throw error; // unexpected: let error.tsx handle it
  }

  // 4. revalidate, 5. redirect (outside try/catch)
  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}
```

## Calling actions from the client

| Situation                                | Use                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| A form                                   | React Hook Form `onSubmit` calls the action. See [10](10-validation-and-forms.md) |
| A single button (delete, mark as paid)   | `useTransition` + the action, plus a toast showing the result                     |
| Instant feedback (toggle, like, reorder) | `useOptimistic`                                                                   |

```tsx
"use client";

export function MarkAsPaidButton({ invoiceId }: { invoiceId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await markInvoicePaidAction(invoiceId);
      if (result.ok) toast.success("Invoice marked as paid");
      else toast.error(result.error);
    });
  }

  return (
    <Button onClick={handleClick} disabled={isPending}>
      {isPending ? "Saving…" : "Mark as paid"}
    </Button>
  );
}
```

Destructive actions (delete, void) require a confirmation `<AlertDialog>` first.

## Don't

- **Don't skip auth "because the page is already protected".** The page's protection doesn't cover the action endpoint.
- **Don't trust IDs or roles sent from the client.** Read the user from the session, and let the backend check ownership.
- **Don't call `redirect()` inside `try/catch`.** The `catch` intercepts it, so the redirect never happens.
- **Don't use route handlers + `fetch` for UI mutations.** That gives up type safety, progressive enhancement, and built-in revalidation.
- **Don't use Server Actions for reads.** They run one at a time and aren't cached. Use queries for reads.

## Related

[10 Validation & forms](10-validation-and-forms.md) · [12 Authentication](12-authentication.md) · [13 Error handling](13-error-handling.md)
