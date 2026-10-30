"use client";

import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Radix Select can't hold "", so an optional field's "none" choice uses this value. */
const NONE = "__none__";

export type SelectOption = { value: string; label: string; disabled?: boolean };

type SelectFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  options: SelectOption[];
  placeholder?: string;
  /** Offers an empty choice with this label; the form value is then "". */
  noneLabel?: string;
  description?: string;
  disabled?: boolean;
};

/** A labelled select wired to React Hook Form, with its description and error linked. */
export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder = "Choose…",
  noneLabel,
  description,
  disabled,
}: SelectFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const value = field.value ? String(field.value) : noneLabel ? NONE : "";
        const selected = options.find((option) => option.value === field.value);
        const describedBy =
          [description && `${name}-description`, fieldState.invalid && `${name}-error`]
            .filter(Boolean)
            .join(" ") || undefined;
        return (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <Select
              name={field.name}
              value={value}
              onValueChange={(next) => field.onChange(next === NONE ? "" : next)}
              disabled={disabled}
            >
              <SelectTrigger
                id={name}
                aria-invalid={fieldState.invalid}
                aria-describedby={describedBy}
                onBlur={field.onBlur}
                className="w-full bg-background"
              >
                <SelectValue placeholder={placeholder}>
                  {selected?.label ?? (value === NONE ? noneLabel : undefined)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {noneLabel && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {description && !fieldState.invalid && (
              <FieldDescription id={`${name}-description`}>{description}</FieldDescription>
            )}
            <FieldError id={`${name}-error`} errors={[fieldState.error]} />
          </Field>
        );
      }}
    />
  );
}
