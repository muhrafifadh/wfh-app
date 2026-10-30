import type { Metadata } from "next";

import { PlannedPage } from "@/app/(app)/_components/planned-page";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <PlannedPage
      title="Reports"
      description="Attendance reports with filters and CSV export."
      phase="4D"
      anyOf={["report:read_team", "report:read_all"]}
    />
  );
}
