# 10 · Validation & Forms

## Schema rules

- **Each feature keeps all its schemas in `features/<feature>/schemas.ts`.**
- **The form and the Server Action use the same schema.** Client-side validation is for user experience. Server-side validation is for security. Always do both, from one schema.
- **Write response schemas too** (for `queries.ts`). They define the domain types: `type Invoice = z.infer<typeof invoiceSchema>`.
- **Validation messages are for users:** `"Enter a valid email"`, not `"Invalid string"`.
- **Convert input types inside the schema**, not in the component. For example, use `z.coerce.number()` for numeric inputs and `.trim()` on text.
- **Build one schema from another** with `.pick()`, `.omit()`, `.extend()`, and `.partial()` instead of copying fields.

```ts
// features/invoices/schemas.ts
import { z } from "zod";

import { INVOICE_STATUSES } from "./constants";

export const invoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  customerId: z.string(),
  status: z.enum(INVOICE_STATUSES),
  amount: z.int(), // minor units (e.g. cents), see backend docs/05-api-design.md
  currency: z.string().length(3),
  dueDate: z.iso.date(),
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const createInvoiceSchema = z.object({
  number: z.string().trim().min(1, "Invoice number is required"),
  customerId: z.string().min(1, "Choose a customer"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  dueDate: z.iso.date("Choose a due date"),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const updateInvoiceSchema = createInvoiceSchema.partial();
```

## Form rules

- **Build forms with React Hook Form + `zodResolver` + the shadcn `<Form>` components.**
- **Every field has a visible label** (`<FormLabel>`). A placeholder doesn't count as a label.
- **Show errors inline, under the field they belong to.** Put errors that don't belong to one field (from the `ActionResult`) at the top of the form, in an `<Alert>`.
- **Field errors returned by the server go back into the form** with `form.setError`.
- **Disable the submit button while the form submits**, and change its label (`Saving…`). The rest of the form stays visible.
- **Type the form with the schema's input and output types** (`useForm<z.input<…>, unknown, z.infer<…>>`) when the schema converts values (e.g. `z.coerce`). `onSubmit` then receives the converted values.
- **Set `defaultValues` for every field.** Otherwise React warns when inputs switch from uncontrolled to controlled.
- **When the user leaves a long or multi-step form with unsaved changes, ask them to confirm first.**

## Example

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createInvoiceAction } from "../actions";
import { createInvoiceSchema, type CreateInvoiceInput } from "../schemas";

type FormValues = z.input<typeof createInvoiceSchema>; // before coercion

export function CreateInvoiceForm() {
  const form = useForm<FormValues, unknown, CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: { number: "", customerId: "", amount: 0, dueDate: "" },
  });

  async function handleSubmit(values: CreateInvoiceInput) {
    const result = await createInvoiceAction(values); // redirects on success
    if (result.ok) return;
    for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
      form.setError(field as keyof FormValues, { message: messages?.[0] });
    }
    form.setError("root", { message: result.error });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="grid gap-4">
        {form.formState.errors.root && (
          <Alert variant="destructive">{form.formState.errors.root.message}</Alert>
        )}

        <FormField
          control={form.control}
          name="number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Invoice number</FormLabel>
              <FormControl><Input {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* …other fields */}

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Saving…" : "Create invoice"}
        </Button>
      </form>
    </Form>
  );
}
```

## Don't

- **Don't keep one schema in the form and a different one in the action.** They will drift apart until the client accepts input the server rejects.
- **Don't manage each input with its own `useState`.** Use React Hook Form.
- **Don't validate inside `onChange` handlers by hand.** The resolver already does it.
- **Don't show a toast for a field error.** Show it next to the field. Use toasts for results that don't belong to the form ([13](13-error-handling.md)).

## Related

[09 Server Actions](09-server-actions.md) · [03 TypeScript](03-typescript.md) · [15 Accessibility](15-accessibility.md)
