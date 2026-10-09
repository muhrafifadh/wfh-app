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
import type { Role } from "@/features/users/schemas";

type RoleFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  roles: Role[];
  disabled?: boolean;
  description?: string;
};

/** The role select used by the invite and edit forms. */
export function RoleField<T extends FieldValues>({
  control,
  name,
  roles,
  disabled,
  description,
}: RoleFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = roles.find((role) => role.id === field.value);
        const describedBy =
          [description && `${name}-description`, fieldState.invalid && `${name}-error`]
            .filter(Boolean)
            .join(" ") || undefined;
        return (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={name}>Role</FieldLabel>
            <Select
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
            >
              <SelectTrigger
                id={name}
                aria-invalid={fieldState.invalid}
                aria-describedby={describedBy}
                className="w-full"
              >
                <SelectValue placeholder="Choose a role">
                  {selected && <span className="capitalize">{selected.name}</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    <span className="capitalize">{role.name}</span>
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
