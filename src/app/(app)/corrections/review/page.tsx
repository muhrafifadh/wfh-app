import type { Metadata } from "next";

import { PlannedPage } from "@/app/(app)/_components/planned-page";

export const metadata: Metadata = { title: "Correction review" };

export default function CorrectionReviewPage() {
  return (
    <PlannedPage
      title="Correction review"
      description="Approve or reject correction requests."
      phase="4D"
      anyOf={["correction:decide_team", "correction:decide_all"]}
    />
  );
}
