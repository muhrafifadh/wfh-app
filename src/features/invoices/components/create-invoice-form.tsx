"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createInvoiceAction } from "@/features/invoices/actions";
import {
  DateInput,
  describedBy,
  TextInput,
} from "@/features/invoices/components/invoice-form-fields";
import { invoiceStatusLabel } from "@/features/invoices/components/invoice-status-badge";
import { NEW_INVOICE_STATUSES } from "@/features/invoices/constants";
import {
  createInvoiceSchema,
  type CreateInvoiceFormValues,
  type CreateInvoiceInput,
} from "@/features/invoices/schemas";

const DEFAULT_VALUES: CreateInvoiceFormValues = {
  customer: "",
  email: "",
  amount: "",
  dueDate: "",
  status: "draft",
  notes: "",
  emailCopy: false,
};

const FIELDS = Object.keys(DEFAULT_VALUES) as (keyof CreateInvoiceFormValues)[];

export function CreateInvoiceForm() {
  const form = useForm<CreateInvoiceFormValues, unknown, CreateInvoiceInput>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { isSubmitting, errors } = form.formState;

  async function handleSubmit() {
    // Send the raw input: the action parses it with the same schema.
    const result = await createInvoiceAction(form.getValues());
    if (result.ok) {
      toast.success(`Invoice for ${result.data.customer} created`, {
        description: "This is an example, so nothing was saved.",
      });
      form.reset();
      return;
    }
    for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
      const known = FIELDS.find((f) => f === field);
      if (known && messages?.[0]) form.setError(known, { message: messages[0] });
    }
    form.setError("root", { message: result.error });
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} noValidate>
      <FieldGroup>
        {errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 sm:grid-cols-2">
          <TextInput
            control={form.control}
            name="customer"
            label="Customer"
            autoComplete="organization"
          />
          <TextInput
            control={form.control}
            name="email"
            label="Billing email"
            type="email"
            autoComplete="email"
          />
          <TextInput
            control={form.control}
            name="amount"
            label="Amount (USD)"
            inputMode="decimal"
          />
          <DateInput control={form.control} name="dueDate" label="Due date" />
        </div>

        <Controller
          control={form.control}
          name="status"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <Select name={field.name} value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  id="status"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={describedBy("status", fieldState.invalid)}
                  className="w-full sm:w-48"
                >
                  <SelectValue>{invoiceStatusLabel(field.value)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {NEW_INVOICE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {invoiceStatusLabel(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="status-error" errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="notes"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Textarea
                {...field}
                id="notes"
                rows={4}
                aria-invalid={fieldState.invalid}
                aria-describedby={describedBy("notes", fieldState.invalid, true)}
              />
              <FieldDescription id="notes-description">
                Optional. Printed at the bottom of the invoice.
              </FieldDescription>
              <FieldError id="notes-error" errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="emailCopy"
          render={({ field }) => (
            <Field orientation="horizontal">
              <Checkbox
                id="emailCopy"
                name={field.name}
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
              <FieldLabel htmlFor="emailCopy" className="font-normal">
                Email me a copy
              </FieldLabel>
            </Field>
          )}
        />

        <Field orientation="horizontal">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create invoice"}
          </Button>
          <Button type="button" variant="outline" onClick={() => form.reset()}>
            Reset
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
