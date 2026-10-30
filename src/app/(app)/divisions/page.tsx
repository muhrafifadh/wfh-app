import type { Metadata } from "next";

import { PlannedPage } from "@/app/(app)/_components/planned-page";

export const metadata: Metadata = { title: "Divisions" };

export default function DivisionsPage() {
  return (
    <PlannedPage
      title="Divisions"
      description="Manage the divisions employees belong to."
      phase="4B"
      anyOf={["division:manage"]}
    />
  );
}
