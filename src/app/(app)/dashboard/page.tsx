import type { Metadata } from "next";

import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = { title: "Dashboard" };

// Placeholder until the role-aware Hadir.in dashboards (UX_FLOWS.md §6) land.
export default function DashboardPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <EmptyState
        title="Nothing to show yet"
        description="Your attendance summary will appear here."
      />
    </>
  );
}
