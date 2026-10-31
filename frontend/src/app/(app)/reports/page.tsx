import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DownloadIcon } from "lucide-react";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { UrlSelect } from "@/components/shared/url-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/routes";
import { listDivisionOptions, listManagerOptions } from "@/features/employees/queries";
import { getMeContext } from "@/features/profile/queries";
import { CountCards } from "@/features/reports/components/count-cards";
import { RecordTable } from "@/features/reports/components/record-table";
import { ReportRangeFilter } from "@/features/reports/components/report-range-filter";
import { TrendChart } from "@/features/reports/components/trend-chart";
import { REPORT_COMPLETION_LABEL, REPORT_COMPLETIONS } from "@/features/reports/constants";
import { getReport, getTeamDay, getTrends } from "@/features/reports/queries";
import { reportRange } from "@/features/reports/range";
import {
  loadReportSearchParams,
  reportCsvHref,
  reportHref,
  type ReportFilters,
} from "@/features/reports/search-params";
import { canAny, can, requireUser, type SessionUser } from "@/lib/auth/session";
import { formatDayDate, formatDuration } from "@/lib/format";

export const metadata: Metadata = { title: "Reports" };

const STATUS_OPTIONS = [
  { value: "present", label: "Present" },
  { value: "late", label: "Late" },
  { value: "absent", label: "Absent" },
  { value: "excused", label: "Excused" },
];

/** Admin/HR filter by the organization; managers by their direct reports. */
async function filterOptions(user: SessionUser) {
  if (can(user, "report:read_all") && can(user, "employee:manage")) {
    const [divisions, employees] = await Promise.all([listDivisionOptions(), listManagerOptions()]);
    return {
      divisions: divisions.map((d) => ({ value: d.id, label: d.name })),
      employees: employees.map((e) => ({
        value: e.id,
        label: `${e.fullName} (${e.employeeNumber})`,
      })),
    };
  }
  if (!can(user, "report:read_all") && can(user, "attendance:read_team")) {
    const team = await getTeamDay("").catch(() => null);
    return {
      divisions: [],
      employees: (team?.items ?? []).map(({ employee }) => ({
        value: employee.id,
        label: `${employee.fullName} (${employee.employeeNumber})`,
      })),
    };
  }
  return { divisions: [], employees: [] };
}

// UX_FLOWS.md §11 — team scope for managers, the organization for Admin/HR (the backend scopes it).
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requireUser();
  if (!canAny(user, ["report:read_team", "report:read_all"])) return <NoAccess title="Reports" />;
  const [filters, context, options] = await Promise.all([
    loadReportSearchParams(searchParams),
    getMeContext(),
    filterOptions(user),
  ]);
  const today = context.organization.workDate;
  const range = reportRange(filters, today);
  const shown = "error" in range ? null : range;
  const canExport = can(user, "report:read_all");

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        {canExport && shown && (
          <Button variant="outline" className="ml-auto" asChild>
            <a href={reportCsvHref({ ...filters, ...shown })} download>
              <DownloadIcon aria-hidden />
              Export CSV
            </a>
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        {can(user, "report:read_all")
          ? "Attendance across the organization."
          : "Attendance of your direct reports."}
        {canExport &&
          " The export has every row for these filters, and is recorded in the audit log."}
      </p>
      <div className="flex flex-col gap-3">
        <ReportRangeFilter
          key={`${filters.from}|${filters.to}`}
          from={shown?.from ?? filters.from}
          to={shown?.to ?? filters.to}
          today={today}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {options.divisions.length > 0 && (
            <UrlSelect
              param="divisionId"
              label="Filter by division"
              allLabel="All divisions"
              options={options.divisions}
            />
          )}
          {options.employees.length > 0 && (
            <UrlSelect
              param="employeeId"
              label="Filter by employee"
              allLabel="All employees"
              options={options.employees}
            />
          )}
          <UrlSelect
            param="status"
            label="Filter by status"
            allLabel="All statuses"
            options={STATUS_OPTIONS}
          />
          <UrlSelect
            param="completion"
            label="Filter by completion"
            allLabel="Any completion"
            options={REPORT_COMPLETIONS.map((value) => ({
              value,
              label: REPORT_COMPLETION_LABEL[value],
            }))}
          />
          <Button variant="ghost" asChild>
            <Link href={routes.reports()}>Reset filters</Link>
          </Button>
        </div>
      </div>
      {shown ? (
        <Suspense key={JSON.stringify({ ...filters, ...shown })} fallback={<ReportSkeleton />}>
          <ReportResults
            filters={filters}
            from={shown.from}
            to={shown.to}
            timeZone={context.organization.timezone}
          />
        </Suspense>
      ) : (
        <Alert variant="destructive">
          <AlertDescription>{"error" in range && range.error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}

function ReportSkeleton() {
  return (
    <>
      <Skeleton className="h-24" />
      <Skeleton className="h-72 rounded-xl" />
      <TableSkeleton rows={5} label="Loading the report" />
    </>
  );
}

async function ReportResults({
  filters,
  from,
  to,
  timeZone,
}: {
  filters: ReportFilters;
  from: string;
  to: string;
  timeZone: string;
}) {
  const query = { ...filters, from, to };
  const [report, trends] = await Promise.all([
    getReport(query),
    getTrends({ from, to, employeeId: filters.employeeId, divisionId: filters.divisionId }),
  ]);
  const { summary } = report;
  const base = { ...filters, from, to, page: 1 };

  return (
    <>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {formatDayDate(from)} – {formatDayDate(to)} · {summary.records} record
        {summary.records === 1 ? "" : "s"}
      </p>
      <CountCards
        label="Report summary"
        cards={[
          {
            label: "Present",
            value: summary.present,
            href: reportHref({ ...base, status: "present" }),
          },
          { label: "Late", value: summary.late, href: reportHref({ ...base, status: "late" }) },
          {
            label: "Absent",
            value: summary.absent,
            href: reportHref({ ...base, status: "absent" }),
          },
          {
            label: "Missing check-out",
            value: summary.incomplete,
            href: reportHref({ ...base, completion: "incomplete" }),
          },
          {
            label: "Worked",
            value: formatDuration(summary.workedMinutes),
            hint: `${summary.corrected} corrected`,
          },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Daily trend</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart
            points={trends.items}
            title={`Present, late, incomplete and absent per working day, ${formatDayDate(from)} to ${formatDayDate(to)}`}
          />
        </CardContent>
      </Card>
      <section aria-labelledby="records-heading" className="flex flex-col gap-3">
        <h2 id="records-heading" className="text-lg font-semibold">
          Records
        </h2>
        {report.total === 0 ? (
          <EmptyState
            title="No attendance matches these filters"
            action={
              <Button variant="outline" asChild>
                <Link href={routes.reports()}>Reset filters</Link>
              </Button>
            }
          />
        ) : (
          <>
            <RecordTable records={report.items} timeZone={timeZone} />
            <ListPagination
              page={report.page}
              pageSize={report.pageSize}
              total={report.total}
              hrefFor={(page) => reportHref({ ...base, page })}
            />
          </>
        )}
      </section>
    </>
  );
}
