import type { Metadata } from "next";
import { Suspense } from "react";

import { AcceptInviteForm } from "@/features/auth/components/accept-invite-form";

export const metadata: Metadata = {
  title: "Accept invitation",
  // The token is in the URL: never send it to other sites
  referrer: "no-referrer",
};

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptInviteForm />
    </Suspense>
  );
}
