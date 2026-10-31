"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { verifyEmailAction } from "@/features/auth/actions";
import { FormAlert } from "@/features/auth/components/form-alert";
import { FormHeader } from "@/features/auth/components/form-header";

/**
 * Verifies on click, not on page load: email security scanners open links,
 * and would otherwise use up the single-use token before the user does.
 */
export function VerifyEmailCard() {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<{ verified: boolean; error?: string }>({ verified: false });
  const [isPending, startTransition] = useTransition();

  if (!token) {
    return (
      <FormHeader
        title="This link is incomplete"
        description="Open the link from your email again, or request a new one from the app."
      />
    );
  }

  if (state.verified) {
    return (
      <div className="flex flex-col gap-6">
        <FormHeader title="Email verified" description="Thanks! Your email address is confirmed." />
        <Button asChild>
          <Link href={routes.dashboard()}>Go to the dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FormHeader
        title="Verify your email"
        description="Confirm this is your email address to finish setting up your account"
      />
      <FormAlert message={state.error} />
      <Button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await verifyEmailAction({ token });
            setState(result.ok ? { verified: true } : { verified: false, error: result.error });
          })
        }
      >
        {isPending ? "Verifying…" : "Verify my email"}
      </Button>
    </div>
  );
}
