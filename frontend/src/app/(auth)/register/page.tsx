import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RegisterForm } from "@/features/auth/components/register-form";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  if (!env.REGISTRATION_ENABLED) notFound();
  return <RegisterForm />;
}
