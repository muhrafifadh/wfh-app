import type { Metadata } from "next";

import { PlannedPage } from "@/app/(app)/_components/planned-page";

export const metadata: Metadata = { title: "Holidays" };

export default function HolidaysPage() {
  return (
    <PlannedPage
      title="Holidays"
      description="Manage the organization's non-working days."
      phase="4B"
      anyOf={["holiday:manage"]}
    />
  );
}
