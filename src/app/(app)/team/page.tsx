import type { Metadata } from "next";

import { PlannedPage } from "@/app/(app)/_components/planned-page";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage() {
  return (
    <PlannedPage
      title="Team"
      description="Your direct reports' attendance today and over time."
      phase="4D"
      anyOf={["attendance:read_team"]}
    />
  );
}
