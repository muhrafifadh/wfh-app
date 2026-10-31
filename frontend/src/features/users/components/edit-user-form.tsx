"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { TextField } from "@/components/shared/text-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { updateUserAction } from "@/features/users/actions";
import { RoleField } from "@/features/users/components/role-field";
import {
  updateUserSchema,
  type Role,
  type UpdateUserInput,
  type User,
} from "@/features/users/schemas";

const FIELDS = ["name", "roleId"] as const;

type EditUserFormProps = {
  user: Pick<User, "id" | "name" | "role">;
  roles: Role[];
  /** Editing yourself: your role is locked (you could lock everyone out). */
  isSelf: boolean;
};

export function EditUserForm({ user, roles, isSelf }: EditUserFormProps) {
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { name: user.name, roleId: user.role.id },
  });
  const { isSubmitting, isDirty, errors } = form.formState;

  async function handleSubmit(values: UpdateUserInput) {
    const result = await updateUserAction(user.id, values);
    if (result.ok) {
      toast.success("Changes saved");
      form.reset({ name: result.data.name, roleId: result.data.role.id });
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
        <TextField control={form.control} name="name" label="Name" autoComplete="off" />
        <RoleField
          control={form.control}
          name="roleId"
          roles={roles}
          disabled={isSelf}
          description={isSelf ? "You can't change your own role." : undefined}
        />
        <Field orientation="horizontal">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
