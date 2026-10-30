import type { FieldErrors } from "@/lib/actions";

import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

/** Puts server field errors on the matching inputs and the message at the top. */
export function applyServerErrors<T extends FieldValues>(
  form: UseFormReturn<T>,
  fields: readonly FieldPath<T>[],
  error: string,
  fieldErrors: FieldErrors | undefined,
): void {
  for (const [field, messages] of Object.entries(fieldErrors ?? {})) {
    const known = fields.find((f) => f === field);
    if (known && messages?.[0]) form.setError(known, { message: messages[0] });
  }
  form.setError("root", { message: error });
}
