import type { Metadata } from "next";

import { PlannedPage } from "@/app/(app)/_components/planned-page";

export const metadata: Metadata = { title: "Request a correction" };

export default function NewCorrectionPage() {
  return (
    <PlannedPage
      title="Request a correction"
      description="Propose the right check-in or check-out time, with a reason."
      phase="4D"
      anyOf={["correction:submit"]}
      needsEmployeeProfile
    />
  );
}
