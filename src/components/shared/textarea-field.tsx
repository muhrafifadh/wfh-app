"use client";

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

type TextareaFieldProps<T extends FieldValues, O extends FieldValues = T> = {
  control: Control<T, unknown, O>;
  name: FieldPath<T>;
  label: string;
  description?: string;
  /** Shows "123 / 1,000" under the field. */
  maxLength?: number;
  rows?: number;
  disabled?: boolean;
};

/** A labelled textarea wired to React Hook Form, with an optional character counter. */
export function TextareaField<T extends FieldValues, O extends FieldValues = T>({
  control,
  name,
  label,
  description,
  maxLength,
  rows = 4,
  disabled,
}: TextareaFieldProps<T, O>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const length = String(field.value ?? "").trim().length;
        const describedBy = [
          description && `${name}-description`,
          maxLength && `${name}-count`,
        ].filter(Boolean);
        return (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <Textarea
              {...field}
              value={field.value ?? ""}
              id={name}
              rows={rows}
              disabled={disabled}
              aria-invalid={fieldState.invalid}
              aria-describedby={describedBy.join(" ") || undefined}
              className="bg-background"
            />
            <div className="flex items-start justify-between gap-2">
              {fieldState.invalid ? (
                <FieldError errors={[fieldState.error]} />
              ) : (
                description && (
                  <FieldDescription id={`${name}-description`}>{description}</FieldDescription>
                )
              )}
              {maxLength && (
                <p
                  id={`${name}-count`}
                  className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums"
                >
                  {length.toLocaleString("en-US")} / {maxLength.toLocaleString("en-US")}
                </p>
              )}
            </div>
          </Field>
        );
      }}
    />
  );
}
