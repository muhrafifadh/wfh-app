import type { Metadata } from "next";

import { loadMyChecks, loadToday } from "@/app/(app)/_components/load-today";
import { EmployeeSection } from "@/app/(app)/dashboard/_components/employee-section";
import { OrganizationSection } from "@/app/(app)/dashboard/_components/organization-section";
import { TeamSection } from "@/app/(app)/dashboard/_components/team-section";
import { EmptyState } from "@/components/shared/empty-state";
import { formatLongDate, greeting } from "@/features/attendance/format";
import { getMeContext } from "@/features/profile/queries";
import { loadDashboardSearchParams } from "@/features/reports/search-params";
import { can, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

// UX_FLOWS.md §6 — role-aware: my attendance (with a profile), then my team (Manager)
// or the organization (Admin/HR). Each part shows only what the caller may see.
export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const user = await requireUser();
  const [context, filters] = await Promise.all([
    getMeContext(),
    loadDashboardSearchParams(searchParams),
  ]);
  const { organization } = context;
  const firstName = user.name.split(/\s+/)[0] ?? user.name;
  const ownAttendance = Boolean(context.employee) && can(user, "attendance:self");
  const organizationView = can(user, "attendance:read_all");
  const teamView = !organizationView && can(user, "attendance:read_team");
  const today = ownAttendance ? await loadToday() : null;
  const checks = ownAttendance ? await loadMyChecks() : null;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {today ? greeting(today.serverTime, organization.timezone) : "Welcome"}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">{formatLongDate(organization.workDate)}</p>
      </div>
      {ownAttendance && (
        <EmployeeSection
          today={today}
          checks={checks}
          workDate={organization.workDate}
          supportContact={organization.supportContact}
          canRequestCorrections={can(user, "correction:submit")}
        />
      )}
      {organizationView && (
        <OrganizationSection
          filters={filters}
          canFilter={can(user, "employee:manage")}
          canReview={can(user, "correction:decide_all")}
        />
      )}
      {teamView && (
        <TeamSection
          workDate={organization.workDate}
          canDecide={can(user, "correction:decide_team")}
          canReport={can(user, "report:read_team")}
        />
      )}
      {!ownAttendance && !organizationView && !teamView && (
        <EmptyState
          title="Nothing to show yet"
          description="Your account has no employee profile and no team or organization view."
        />
      )}
    </>
  );
}
