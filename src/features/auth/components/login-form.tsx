"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { TextField } from "@/components/shared/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { routes } from "@/config/routes";
import { loginAction } from "@/features/auth/actions";
import { FormAlert } from "@/features/auth/components/form-alert";
import { FormHeader } from "@/features/auth/components/form-header";
import { applyServerErrors } from "@/features/auth/form-errors";
import { loginSchema, type LoginInput } from "@/features/auth/schemas";

export function LoginForm({ canRegister }: { canRegister: boolean }) {
  const searchParams = useSearchParams();
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function handleSubmit(values: LoginInput) {
    const result = await loginAction(values, searchParams.get("next")); // redirects on success
    if (!result.ok)
      applyServerErrors(form, ["email", "password"], result.error, result.fieldErrors);
  }

  const { isSubmitting, errors } = form.formState;

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="flex flex-col gap-6">
      <FieldGroup>
        <FormHeader
          title="Sign in to Hadir.in"
          description="Check in for your work-from-home day with your work email."
        />
        {searchParams.get("reset") === "1" && !errors.root && (
          <FormAlert
            variant="default"
            message="Password updated. Sign in with your new password."
          />
        )}
        <FormAlert message={errors.root?.message} />

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
          autoComplete="current-password"
          labelAction={
            <Link
              href={routes.forgotPassword()}
              className="text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </Link>
          }
        />

        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
          {canRegister && (
            <FieldDescription className="text-center">
              Don&apos;t have an account?{" "}
              <Link href={routes.register()} className="underline underline-offset-4">
                Sign up
              </Link>
            </FieldDescription>
          )}
        </Field>
      </FieldGroup>
    </form>
  );
}
