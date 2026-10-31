"use client";

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type TextFieldProps<T extends FieldValues, O extends FieldValues = T> = {
  control: Control<T, unknown, O>;
  name: FieldPath<T>;
  label: string;
  type?: "text" | "email" | "password" | "date" | "time" | "number";
  autoComplete?: string;
  description?: string;
  /** Rendered next to the label, e.g. a "Forgot your password?" link. */
  labelAction?: React.ReactNode;
  /** Passed to the input, e.g. `min`/`max` for dates, `step` for times. */
  inputProps?: Pick<React.ComponentProps<"input">, "min" | "max" | "step" | "inputMode" | "onBlur">;
  disabled?: boolean;
};

/** One labelled input wired to React Hook Form, with its error under it. */
export function TextField<T extends FieldValues, O extends FieldValues = T>({
  control,
  name,
  label,
  type = "text",
  autoComplete,
  description,
  labelAction,
  inputProps,
  disabled,
}: TextFieldProps<T, O>) {
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
            {...inputProps}
            {...field}
            onBlur={(event) => {
              inputProps?.onBlur?.(event);
              field.onBlur();
            }}
            value={field.value ?? ""}
            disabled={disabled}
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
