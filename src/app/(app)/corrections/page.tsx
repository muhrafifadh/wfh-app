import type { Metadata } from "next";

import { PlannedPage } from "@/app/(app)/_components/planned-page";

export const metadata: Metadata = { title: "My corrections" };

export default function CorrectionsPage() {
  return (
    <PlannedPage
      title="My corrections"
      description="Ask for a fix to a check-in or check-out time."
      phase="4D"
      anyOf={["correction:submit"]}
      needsEmployeeProfile
    />
  );
}
