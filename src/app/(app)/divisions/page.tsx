import type { Metadata } from "next";
import { Suspense } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { AddDivisionButton } from "@/features/divisions/components/add-division-button";
import { DivisionFilters } from "@/features/divisions/components/division-filters";
import { DivisionTable } from "@/features/divisions/components/division-table";
import { loadDivisionSearchParams } from "@/features/divisions/search-params";
import { can, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Divisions" };

export default async function DivisionsPage({ searchParams }: PageProps<"/divisions">) {
  const user = await requireUser();
  if (!can(user, "division:manage")) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Divisions</h1>
        <EmptyState
          title="You don't have access to this page"
          description="Ask your Admin/HR if you think you should."
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Divisions</h1>
        <div className="ml-auto">
          <AddDivisionButton />
        </div>
      </div>
      <Suspense>
        <DivisionFilters />
      </Suspense>
      <Suspense fallback={<TableSkeleton label="Loading divisions" />}>
        <DivisionResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function DivisionResults({ searchParams }: Pick<PageProps<"/divisions">, "searchParams">) {
  const filters = await loadDivisionSearchParams(searchParams);
  return <DivisionTable filters={filters} />;
}
