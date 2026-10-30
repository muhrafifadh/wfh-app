import type { Metadata } from "next";

import { PlannedPage } from "@/app/(app)/_components/planned-page";

export const metadata: Metadata = { title: "Attendance settings" };

export default function AttendanceSettingsPage() {
  return (
    <PlannedPage
      title="Attendance settings"
      description="Set the work schedule and attendance policy."
      phase="4B"
      anyOf={["policy:manage"]}
    />
  );
}
