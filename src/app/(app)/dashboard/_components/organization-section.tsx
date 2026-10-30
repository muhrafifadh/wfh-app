import Link from "next/link";

import { UrlSelect } from "@/components/shared/url-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { reviewHref } from "@/features/corrections/search-params";
import { listDivisionOptions, listManagerOptions } from "@/features/employees/queries";
import { CountCards, type CountCard } from "@/features/reports/components/count-cards";
import { RefreshBar } from "@/features/reports/components/refresh-bar";
import { TrendChart } from "@/features/reports/components/trend-chart";
import { getOrganizationDashboard } from "@/features/reports/queries";
import { reportHref, type DashboardFilters } from "@/features/reports/search-params";

/**
 * UX_FLOWS.md §6.3 — the organization today, pending corrections and the 30-working-day
 * trend, narrowed by division or employee. Numbers with a list behind them link to it.
 */
export async function OrganizationSection({
  filters,
  canFilter,
  canReview,
}: {
  filters: DashboardFilters;
  /** Division and employee options come from the employee directory (employee:manage). */
  canFilter: boolean;
  canReview: boolean;
}) {
  const [dashboard, divisions, employees] = await Promise.all([
    getOrganizationDashboard(filters),
    canFilter ? listDivisionOptions() : [],
    canFilter ? listManagerOptions() : [],
  ]);
  const today = dashboard.workDate;
  const scope = { divisionId: filters.divisionId, employeeId: filters.employeeId };
  const dayReport = (status: "present" | "late" | "absent") =>
    reportHref({ from: today, to: today, status, ...scope });

  const cards: CountCard[] = [
    {
      label: "Active employees",
      value: dashboard.activeEmployees,
      href: canFilter ? `${routes.employees()}?status=active` : undefined,
    },
    { label: "Present", value: dashboard.present, href: dayReport("present") },
    { label: "Late", value: dashboard.late, href: dayReport("late") },
    {
      label: "Not checked in",
      value: dashboard.notCheckedIn,
      hint: !dashboard.isWorkingDay
        ? "Not a working day"
        : dashboard.checkInWindowClosed
          ? "Check-in has closed; marked absent after the day closes"
          : "Check-in is still open",
    },
    {
      label: "Not checked out",
      value: dashboard.notCheckedOut,
      hint: "Past the scheduled end",
    },
    {
      label: "Absent",
      value: dashboard.absent,
      href: dayReport("absent"),
      hint: "Recorded absences",
    },
    {
      label: "Pending corrections",
      value: dashboard.pendingCorrections,
      href: canReview
        ? reviewHref({ divisionId: filters.divisionId, employeeId: filters.employeeId })
        : undefined,
    },
  ];

  return (
    <section aria-labelledby="organization-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="organization-heading" className="text-xl font-semibold tracking-tight">
          Organization today
        </h2>
        <RefreshBar serverTime={dashboard.serverTime} timeZone={dashboard.timezone} />
      </div>
      {canFilter && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <UrlSelect
            param="divisionId"
            label="Filter by division"
            allLabel="All divisions"
            options={divisions.map((d) => ({ value: d.id, label: d.name }))}
          />
          <UrlSelect
            param="employeeId"
            label="Filter by employee"
            allLabel="All employees"
            options={employees.map((e) => ({
              value: e.id,
              label: `${e.fullName} (${e.employeeNumber})`,
            }))}
          />
        </div>
      )}
      <CountCards label="Organization today" cards={cards} />
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>
            <h3>Last 30 working days</h3>
          </CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={reportHref({ ...scope })}>Open reports</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <TrendChart
            points={dashboard.trend}
            title="Present, late, incomplete and absent employees per working day, last 30 working days"
          />
        </CardContent>
      </Card>
    </section>
  );
}
