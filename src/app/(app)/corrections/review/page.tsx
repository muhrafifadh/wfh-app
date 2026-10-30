import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { UrlSelect } from "@/components/shared/url-select";
import { Button } from "@/components/ui/button";
import { CorrectionList } from "@/features/corrections/components/correction-list";
import { StatusTabs } from "@/features/corrections/components/status-tabs";
import { listReviewQueue } from "@/features/corrections/queries";
import {
  loadReviewSearchParams,
  reviewHref,
  type ReviewFilters,
} from "@/features/corrections/search-params";
import { listDivisionOptions, listManagerOptions } from "@/features/employees/queries";
import { getTeamDay } from "@/features/reports/queries";
import { can, canAny, requireUser, type SessionUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Correction review" };

const TABS = [
  { label: "Pending", status: "pending" },
  { label: "Approved", status: "approved" },
  { label: "Rejected", status: "rejected" },
] as const;

/** Who the reviewer may filter by: the organization (Admin/HR) or their direct reports. */
async function filterOptions(user: SessionUser) {
  if (can(user, "correction:decide_all") && can(user, "employee:manage")) {
    const [divisions, employees] = await Promise.all([listDivisionOptions(), listManagerOptions()]);
    return {
      divisions: divisions.map((d) => ({ value: d.id, label: d.name })),
      employees: employees.map((e) => ({
        value: e.id,
        label: `${e.fullName} (${e.employeeNumber})`,
      })),
    };
  }
  if (can(user, "attendance:read_team")) {
    const team = await getTeamDay("");
    return {
      divisions: [],
      employees: team.items.map(({ employee }) => ({
        value: employee.id,
        label: `${employee.fullName} (${employee.employeeNumber})`,
      })),
    };
  }
  return { divisions: [], employees: [] };
}

// UX_FLOWS.md §9.3 — managers see direct reports, Admin/HR the organization; never your own.
export default async function CorrectionReviewPage({
  searchParams,
}: PageProps<"/corrections/review">) {
  const user = await requireUser();
  if (!canAny(user, ["correction:decide_team", "correction:decide_all"])) {
    return <NoAccess title="Correction review" />;
  }
  const [filters, options] = await Promise.all([
    loadReviewSearchParams(searchParams),
    filterOptions(user),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Correction review</h1>
      <p className="text-sm text-muted-foreground">
        {can(user, "correction:decide_all")
          ? "Requests from across the organization."
          : "Requests from your direct reports."}{" "}
        Your own requests never appear here.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <StatusTabs
          label="Request status"
          tabs={TABS.map((tab) => ({
            label: tab.label,
            href: reviewHref({ ...filters, status: tab.status, page: 1 }),
            active: filters.status === tab.status,
          }))}
        />
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
      </div>
      <Suspense
        key={JSON.stringify(filters)}
        fallback={<TableSkeleton rows={4} label="Loading requests" />}
      >
        <Queue filters={filters} />
      </Suspense>
    </>
  );
}

async function Queue({ filters }: { filters: ReviewFilters }) {
  const result = await listReviewQueue(filters);
  const filtered = Boolean(filters.employeeId || filters.divisionId);
  if (result.total === 0) {
    return (
      <EmptyState
        title={
          filters.status === "pending"
            ? filtered
              ? "No pending requests match these filters"
              : "Nothing to review"
            : `No ${filters.status} requests${filtered ? " match these filters" : ""}`
        }
        description={
          filters.status === "pending" && !filtered
            ? "New requests appear here, oldest first."
            : undefined
        }
        action={
          filtered ? (
            <Button variant="outline" asChild>
              <Link href={reviewHref({ status: filters.status })}>Clear filters</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }
  return (
    <CorrectionList
      result={result}
      showEmployee
      hrefFor={(page) => reviewHref({ ...filters, page })}
    />
  );
}
