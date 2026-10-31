import type { Metadata } from "next";
import { Suspense } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditActionFilter } from "@/features/audit/components/audit-action-filter";
import { AuditLogTable } from "@/features/audit/components/audit-log-table";
import { loadAuditSearchParams } from "@/features/audit/search-params";
import { can, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditLogPage({ searchParams }: PageProps<"/audit-log">) {
  const user = await requireUser();
  if (!can(user, "audit:read")) {
    return (
      <EmptyState
        title="You don't have access to the audit log"
        description="Ask an admin for the audit:read permission."
      />
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Sign-ins and changes to users in your organization, newest first.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-9 w-full sm:w-64" />}>
        <AuditActionFilter />
      </Suspense>
      <Suspense fallback={<TableSkeleton label="Loading audit log" />}>
        <AuditResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function AuditResults({ searchParams }: Pick<PageProps<"/audit-log">, "searchParams">) {
  const filters = await loadAuditSearchParams(searchParams);
  return <AuditLogTable filters={filters} />;
}
