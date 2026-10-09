"use client";

import Link from "next/link";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { routes } from "@/config/routes";
import { registerAction } from "@/features/auth/actions";
import { FormAlert } from "@/features/auth/components/form-alert";
import { FormHeader } from "@/features/auth/components/form-header";
import { applyServerErrors } from "@/features/auth/form-errors";
import { registerSchema, type RegisterInput } from "@/features/auth/schemas";

export function RegisterForm() {
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", organizationName: "", email: "", password: "" },
  });

  async function handleSubmit(values: RegisterInput) {
    const result = await registerAction(values); // redirects on success
    if (!result.ok) {
      applyServerErrors(
        form,
        ["name", "organizationName", "email", "password"],
        result.error,
        result.fieldErrors,
      );
    }
  }

  const { isSubmitting, errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <FormHeader
          title="Create your account"
          description="You'll be the owner of a new organization"
        />
        <FormAlert message={errors.root?.message} />

        <TextField control={form.control} name="name" label="Your name" autoComplete="name" />
        <TextField
          control={form.control}
          name="organizationName"
          label="Organization name"
          autoComplete="organization"
        />
        <TextField
          control={form.control}
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
        />
        <TextField
          control={form.control}
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          description="At least 12 characters."
        />

        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
          <FieldDescription className="text-center">
            Already have an account?{" "}
            <Link href={routes.login()} className="underline underline-offset-4">
              Login
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
