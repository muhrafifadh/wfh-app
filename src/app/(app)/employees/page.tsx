import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PlusIcon } from "lucide-react";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { EmployeeFilters } from "@/features/employees/components/employee-filters";
import { EmployeeTable } from "@/features/employees/components/employee-table";
import { listDivisionOptions, listManagerOptions } from "@/features/employees/queries";
import { loadEmployeeSearchParams } from "@/features/employees/search-params";
import { getMeContext } from "@/features/profile/queries";
import { can, requireUser } from "@/lib/auth/session";
import { todayIn } from "@/lib/time-zone";

export const metadata: Metadata = { title: "Employees" };

export default async function EmployeesPage({ searchParams }: PageProps<"/employees">) {
  const user = await requireUser();
  if (!can(user, "employee:manage")) return <NoAccess title="Employees" />;
  const [divisions, managers, context] = await Promise.all([
    listDivisionOptions(),
    listManagerOptions(),
    getMeContext(),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        <div className="ml-auto">
          <Button asChild>
            <Link href={routes.newEmployee()}>
              <PlusIcon aria-hidden />
              Add employee
            </Link>
          </Button>
        </div>
      </div>
      <Suspense>
        <EmployeeFilters divisions={divisions} managers={managers} />
      </Suspense>
      <Suspense fallback={<TableSkeleton label="Loading employees" />}>
        <EmployeeResults
          searchParams={searchParams}
          today={todayIn(context.organization.timezone)}
        />
      </Suspense>
    </>
  );
}

async function EmployeeResults({
  searchParams,
  today,
}: Pick<PageProps<"/employees">, "searchParams"> & { today: string }) {
  const filters = await loadEmployeeSearchParams(searchParams);
  return <EmployeeTable filters={filters} today={today} />;
}
