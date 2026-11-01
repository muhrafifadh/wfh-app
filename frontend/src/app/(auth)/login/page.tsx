import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/features/auth/components/login-form";
import { PersonaLogin } from "@/features/auth/components/persona-login";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    // useSearchParams() reads the request, so the form streams behind a boundary
    <Suspense>
      <div className="flex flex-col gap-6">
        <LoginForm canRegister={env.REGISTRATION_ENABLED} />
        {env.DEMO_LOGIN_PASSWORD && <PersonaLogin />}
      </div>
    </Suspense>
  );
}
