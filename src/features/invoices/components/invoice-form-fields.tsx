"use client";

import { Controller, type Control } from "react-hook-form";

import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/features/invoices/components/date-picker";
import type { CreateInvoiceFormValues, CreateInvoiceInput } from "@/features/invoices/schemas";

type InvoiceControl = Control<CreateInvoiceFormValues, unknown, CreateInvoiceInput>;

/** Ids that link an input to its description and error for screen readers. */
export const describedBy = (name: string, invalid: boolean, hasDescription = false) =>
  [hasDescription && `${name}-description`, invalid && `${name}-error`].filter(Boolean).join(" ") ||
  undefined;

type TextInputProps = {
  control: InvoiceControl;
  name: "customer" | "email" | "amount";
  label: string;
} & Pick<React.ComponentProps<"input">, "type" | "autoComplete" | "inputMode">;

export function TextInput({ control, name, label, ...inputProps }: TextInputProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <Input
            {...field}
            {...inputProps}
            id={name}
            aria-invalid={fieldState.invalid}
            aria-describedby={describedBy(name, fieldState.invalid)}
          />
          <FieldError id={`${name}-error`} errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

type DateInputProps = { control: InvoiceControl; name: "dueDate"; label: string };

/** A labelled shadcn date picker (not the native input) wired to React Hook Form. */
export function DateInput({ control, name, label }: DateInputProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <DatePicker
            id={name}
            ref={field.ref}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            aria-invalid={fieldState.invalid}
            aria-describedby={describedBy(name, fieldState.invalid)}
          />
          <FieldError id={`${name}-error`} errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}
