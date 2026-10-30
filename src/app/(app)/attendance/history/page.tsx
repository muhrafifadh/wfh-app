import type { Metadata } from "next";

import { PlannedPage } from "@/app/(app)/_components/planned-page";

export const metadata: Metadata = { title: "My history" };

export default function AttendanceHistoryPage() {
  return (
    <PlannedPage
      title="My history"
      description="Your daily records and monthly summary."
      phase="4C"
      anyOf={["attendance:self"]}
      needsEmployeeProfile
    />
  );
}
