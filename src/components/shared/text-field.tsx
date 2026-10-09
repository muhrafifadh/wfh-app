"use client";

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type TextFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  description?: string;
  /** Rendered next to the label, e.g. a "Forgot your password?" link. */
  labelAction?: React.ReactNode;
};

/** One labelled input wired to React Hook Form, with its error under it. */
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  type = "text",
  autoComplete,
  description,
  labelAction,
}: TextFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <div className="flex items-center">
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            {labelAction && <div className="ml-auto">{labelAction}</div>}
          </div>
          <Input
            {...field}
            id={name}
            type={type}
            autoComplete={autoComplete}
            aria-invalid={fieldState.invalid}
            aria-describedby={description ? `${name}-description` : undefined}
            className="bg-background"
          />
          {description && !fieldState.invalid && (
            <FieldDescription id={`${name}-description`}>{description}</FieldDescription>
          )}
          {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  );
}
