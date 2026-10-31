import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { NoEmployeeProfile } from "@/app/(app)/_components/no-employee-profile";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { CorrectionList } from "@/features/corrections/components/correction-list";
import { StatusTabs } from "@/features/corrections/components/status-tabs";
import { listMyCorrections } from "@/features/corrections/queries";
import {
  loadMyCorrectionsSearchParams,
  myCorrectionsHref,
  type MyCorrectionsFilters,
} from "@/features/corrections/search-params";
import { SupportContact } from "@/features/profile/components/support-contact";
import { getMeContext } from "@/features/profile/queries";
import { can, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My corrections" };

const TABS = [
  { label: "All", status: null },
  { label: "Pending", status: "pending" },
  { label: "Approved", status: "approved" },
  { label: "Rejected", status: "rejected" },
] as const;

// UX_FLOWS.md §9.2 — the caller's own requests, newest first.
export default async function CorrectionsPage({ searchParams }: PageProps<"/corrections">) {
  const user = await requireUser();
  if (!can(user, "correction:submit")) return <NoAccess title="My corrections" />;
  const [filters, context] = await Promise.all([
    loadMyCorrectionsSearchParams(searchParams),
    getMeContext(),
  ]);
  const heading = <h1 className="text-2xl font-semibold tracking-tight">My corrections</h1>;
  if (!context.employee) {
    return (
      <>
        {heading}
        <NoEmployeeProfile
          support={<SupportContact contact={context.organization.supportContact} />}
        />
      </>
    );
  }

  return (
    <>
      {heading}
      <p className="text-sm text-muted-foreground">
        To request a correction, open the day in{" "}
        <Link
          href={routes.attendanceHistory()}
          className="text-primary underline-offset-4 hover:underline"
        >
          My history
        </Link>
        .
      </p>
      <StatusTabs
        label="Request status"
        tabs={TABS.map((tab) => ({
          label: tab.label,
          href: myCorrectionsHref({ status: tab.status }),
          active: filters.status === tab.status,
        }))}
      />
      <Suspense
        key={JSON.stringify(filters)}
        fallback={<TableSkeleton rows={3} label="Loading corrections" />}
      >
        <MyCorrections filters={filters} />
      </Suspense>
    </>
  );
}

async function MyCorrections({ filters }: { filters: MyCorrectionsFilters }) {
  const result = await listMyCorrections(filters);
  if (result.total === 0) {
    return filters.status ? (
      <EmptyState
        title={`No ${filters.status} requests`}
        action={
          <Button variant="outline" asChild>
            <Link href={routes.corrections()}>Show all</Link>
          </Button>
        }
      />
    ) : (
      <EmptyState
        title="No correction requests yet"
        description="If a check-in or check-out is wrong, open that day in My history and request a correction."
      />
    );
  }
  return (
    <CorrectionList result={result} hrefFor={(page) => myCorrectionsHref({ ...filters, page })} />
  );
}
