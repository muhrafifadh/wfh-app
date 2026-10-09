import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/features/auth/components/login-form";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    // useSearchParams() reads the request, so the form streams behind a boundary
    <Suspense>
      <LoginForm canRegister={env.REGISTRATION_ENABLED} />
    </Suspense>
  );
}
