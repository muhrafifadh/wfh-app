import type { Metadata } from "next";

import { PlannedPage } from "@/app/(app)/_components/planned-page";

export const metadata: Metadata = { title: "Correction request" };

export default function CorrectionPage() {
  return (
    <PlannedPage
      title="Correction request"
      description="The request, its current and proposed times, and the decision."
      phase="4D"
      anyOf={["correction:submit", "correction:decide_team", "correction:decide_all"]}
    />
  );
}
