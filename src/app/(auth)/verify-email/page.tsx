import type { Metadata } from "next";
import { Suspense } from "react";

import { VerifyEmailCard } from "@/features/auth/components/verify-email-card";

export const metadata: Metadata = {
  title: "Verify email",
  // The token is in the URL: never send it to other sites
  referrer: "no-referrer",
};

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailCard />
    </Suspense>
  );
}
