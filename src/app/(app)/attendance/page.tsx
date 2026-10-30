import type { Metadata } from "next";

import { PlannedPage } from "@/app/(app)/_components/planned-page";

export const metadata: Metadata = { title: "Today's attendance" };

export default function AttendancePage() {
  return (
    <PlannedPage
      title="Today's attendance"
      description="Check in and out, and see today's status."
      phase="4C"
      anyOf={["attendance:self"]}
      needsEmployeeProfile
    />
  );
}
