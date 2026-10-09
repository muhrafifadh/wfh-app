"use server";

import { z } from "zod";

import { createInvoiceSchema, deleteInvoiceSchema } from "@/features/invoices/schemas";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { requireUser } from "@/lib/auth/session";

/**
 * Example action: it authenticates and validates like a real one, but there's no
 * backend for invoices yet, so nothing is saved. When there is: call
 * apiFetch("/invoices", { method: "POST", … }), revalidatePath(routes.invoices()),
 * then redirect to the new invoice (docs/09-server-actions.md).
 */
export async function createInvoiceAction(
  input: unknown,
): Promise<ActionResult<{ customer: string }>> {
  await requireUser();

  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", z.flattenError(parsed.error).fieldErrors);
  }

  return ok({ customer: parsed.data.customer });
}

/**
 * Example destructive action, called after the confirm dialog. Like the create
 * action it checks auth and input, but there's no backend, so nothing is deleted.
 * When there is: apiFetch(`/invoices/${id}`, { method: "DELETE" }), then revalidatePath.
 */
export async function deleteInvoiceAction(
  input: unknown,
): Promise<ActionResult<{ number: string }>> {
  await requireUser();

  const parsed = deleteInvoiceSchema.safeParse(input);
  if (!parsed.success) return fail("That invoice couldn't be found.");

  return ok({ number: parsed.data.number });
}
