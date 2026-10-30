import type { Metadata } from "next";

import { PlannedPage } from "@/app/(app)/_components/planned-page";

export const metadata: Metadata = { title: "Employees" };

export default function EmployeesPage() {
  return (
    <PlannedPage
      title="Employees"
      description="Manage employee profiles, managers and accounts."
      phase="4B"
      anyOf={["employee:manage"]}
    />
  );
}
