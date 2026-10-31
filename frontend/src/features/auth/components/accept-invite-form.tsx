"use client";

import { useSearchParams } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { acceptInvitationAction } from "@/features/auth/actions";
import { FormAlert } from "@/features/auth/components/form-alert";
import { FormHeader } from "@/features/auth/components/form-header";
import { resetPasswordFormSchema, type ResetPasswordFormInput } from "@/features/auth/schemas";
import { applyServerErrors } from "@/lib/form-errors";

export function AcceptInviteForm() {
  const token = useSearchParams().get("token");
  const form = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  if (!token) {
    return (
      <FormHeader
        title="This link is incomplete"
        description="Open the link from your invitation email again, or ask for a new invitation."
      />
    );
  }

  async function handleSubmit(values: ResetPasswordFormInput) {
    // signs in and redirects to the dashboard on success
    const result = await acceptInvitationAction({ token, password: values.password });
    if (!result.ok) applyServerErrors(form, ["password"], result.error, result.fieldErrors);
  }

  const { isSubmitting, errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <FormHeader
          title="Welcome aboard"
          description="Choose a password to finish setting up your account"
        />
        <FormAlert message={errors.root?.message} />

        <TextField
          control={form.control}
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          description="At least 12 characters."
        />
        <TextField
          control={form.control}
          name="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
        />

        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Setting up…" : "Set password and sign in"}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
