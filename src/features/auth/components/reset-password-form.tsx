"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { routes } from "@/config/routes";
import { resetPasswordAction } from "@/features/auth/actions";
import { FormAlert } from "@/features/auth/components/form-alert";
import { FormHeader } from "@/features/auth/components/form-header";
import { TextField } from "@/features/auth/components/text-field";
import { applyServerErrors } from "@/features/auth/form-errors";
import { resetPasswordFormSchema, type ResetPasswordFormInput } from "@/features/auth/schemas";

export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const form = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <FormHeader
          title="This link is incomplete"
          description="Open the link from your email again, or request a new one."
        />
        <Button asChild>
          <Link href={routes.forgotPassword()}>Request a new link</Link>
        </Button>
      </div>
    );
  }

  async function handleSubmit(values: ResetPasswordFormInput) {
    // redirects to /login on success
    const result = await resetPasswordAction({ token, password: values.password });
    if (!result.ok) applyServerErrors(form, ["password"], result.error, result.fieldErrors);
  }

  const { isSubmitting, errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <FormHeader
          title="Choose a new password"
          description="You'll be signed out on all your devices"
        />
        <FormAlert message={errors.root?.message} />

        <TextField
          control={form.control}
          name="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          description="At least 12 characters."
        />
        <TextField
          control={form.control}
          name="confirmPassword"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
        />

        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Set new password"}
          </Button>
          <FieldDescription className="text-center">
            Link expired?{" "}
            <Link href={routes.forgotPassword()} className="underline underline-offset-4">
              Request a new one
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
