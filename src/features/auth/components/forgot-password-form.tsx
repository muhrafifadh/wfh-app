"use client";

import Link from "next/link";
import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { routes } from "@/config/routes";
import { requestPasswordResetAction } from "@/features/auth/actions";
import { FormAlert } from "@/features/auth/components/form-alert";
import { FormHeader } from "@/features/auth/components/form-header";
import { applyServerErrors } from "@/features/auth/form-errors";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/features/auth/schemas";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function handleSubmit(values: ForgotPasswordInput) {
    const result = await requestPasswordResetAction(values);
    if (result.ok) setSentTo(values.email);
    else applyServerErrors(form, ["email"], result.error, result.fieldErrors);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-6" role="status">
        <FormHeader
          title="Check your email"
          description={`If an account exists for ${sentTo}, we sent a link to reset its password. It works for 30 minutes.`}
        />
        <Button variant="outline" asChild>
          <Link href={routes.login()}>Back to login</Link>
        </Button>
      </div>
    );
  }

  const { isSubmitting, errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <FormHeader
          title="Forgot your password?"
          description="Enter your email and we'll send you a link to reset it"
        />
        <FormAlert message={errors.root?.message} />

        <TextField
          control={form.control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
        />

        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send reset link"}
          </Button>
          <FieldDescription className="text-center">
            Remembered it?{" "}
            <Link href={routes.login()} className="underline underline-offset-4">
              Login
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
