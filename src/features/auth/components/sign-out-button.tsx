"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/features/auth/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}

export function SignOutButton() {
  return (
    <form action={logoutAction}>
      <SubmitButton />
    </form>
  );
}
