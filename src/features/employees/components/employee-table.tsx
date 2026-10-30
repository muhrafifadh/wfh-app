import Link from "next/link";

import { PlusIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { SortHeader } from "@/components/shared/sort-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { roleLabel } from "@/config/roles";
import { routes } from "@/config/routes";
import {
  AccountStateBadge,
  EmployeeStatusBadges,
} from "@/features/employees/components/employee-badges";
import type { EmployeeSortField } from "@/features/employees/constants";
import { listEmployees } from "@/features/employees/queries";
import { employeeListHref, type EmployeeFilters } from "@/features/employees/search-params";

const EMPTY = "—";

export async function EmployeeTable({
  filters,
  today,
}: {
  filters: EmployeeFilters;
  /** The organization's date, for "Employment ended". */
  today: string;
}) {
  const result = await listEmployees(filters);
  const filtered = Boolean(filters.q || filters.status || filters.divisionId || filters.managerId);

  if (result.total === 0) {
    return filtered ? (
      <EmptyState
        title="No employees match your filters"
        description="Try a different search, division, manager or status."
        action={
          <Button variant="outline" asChild>
            <Link href={routes.employees()}>Clear filters</Link>
          </Button>
        }
      />
    ) : (
      <EmptyState
        title="No employees yet"
        description="Add employees so they can record their attendance."
        action={
          <Button asChild>
            <Link href={routes.newEmployee()}>
              <PlusIcon aria-hidden />
              Add the first employee
            </Link>
          </Button>
        }
      />
    );
  }

  const sortProps = (field: EmployeeSortField) => {
    const active = filters.sort === field ? filters.order : null;
    const order = active === "asc" ? "desc" : "asc";
    return { active, href: employeeListHref({ ...filters, sort: field, order, page: 1 }) };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Number" {...sortProps("employeeNumber")} />
              <SortHeader label="Name" {...sortProps("fullName")} />
              <TableHead scope="col" className="hidden lg:table-cell">
                Division
              </TableHead>
              <TableHead scope="col" className="hidden xl:table-cell">
                Manager
              </TableHead>
              <TableHead scope="col" className="hidden md:table-cell">
                Account
              </TableHead>
              <TableHead scope="col" className="hidden lg:table-cell">
                Role
              </TableHead>
              <TableHead scope="col">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((employee) => (
              <TableRow key={employee.id}>
                <TableCell className="font-mono">{employee.employeeNumber}</TableCell>
                <TableCell className="whitespace-normal">
                  <Link
                    href={routes.employee(employee.id)}
                    className="block font-medium underline-offset-4 hover:underline"
                  >
                    {employee.fullName}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {employee.workEmail ?? employee.jobTitle ?? EMPTY}
                  </span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">{employee.division.name}</TableCell>
                <TableCell className="hidden xl:table-cell">
                  {employee.manager?.fullName ?? EMPTY}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <AccountStateBadge employee={employee} />
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {employee.account ? roleLabel(employee.account.role.name) : EMPTY}
                </TableCell>
                <TableCell>
                  <EmployeeStatusBadges employee={employee} today={today} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ListPagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        hrefFor={(page) => employeeListHref({ ...filters, page })}
      />
    </div>
  );
}
