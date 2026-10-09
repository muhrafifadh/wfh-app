"use client";

import { useState, useTransition } from "react";

import { MailWarningIcon } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { resendVerificationAction } from "@/features/auth/actions";
import { useCurrentUser } from "@/features/auth/components/current-user-provider";

/** Shown in the app shell until the user verifies their email. */
export function VerifyEmailBanner() {
  const user = useCurrentUser();
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (user.emailVerified) return null;

  return (
    <Alert>
      <MailWarningIcon aria-hidden />
      <AlertTitle>Verify your email</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span>
          We sent a link to <strong className="font-medium">{user.email}</strong>.
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={isPending || sent}
          onClick={() =>
            startTransition(async () => {
              const result = await resendVerificationAction();
              if (result.ok) {
                setSent(true);
                toast.success("Verification email sent");
              } else {
                toast.error(result.error);
              }
            })
          }
        >
          {sent ? "Email sent" : isPending ? "Sending…" : "Resend email"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
