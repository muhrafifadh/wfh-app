import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { SortHeader } from "@/components/shared/sort-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { routes } from "@/config/routes";
import { AddDivisionButton } from "@/features/divisions/components/add-division-button";
import { DivisionRowActions } from "@/features/divisions/components/division-row-actions";
import { DIVISION_STATUS_LABEL, type DivisionSortField } from "@/features/divisions/constants";
import { listDivisions } from "@/features/divisions/queries";
import { divisionListHref, type DivisionFilters } from "@/features/divisions/search-params";

export async function DivisionTable({ filters }: { filters: DivisionFilters }) {
  const result = await listDivisions(filters);
  const filtered = Boolean(filters.q || filters.status);

  if (result.total === 0) {
    return filtered ? (
      <EmptyState
        title="No divisions match your filters"
        description="Try a different search or status."
        action={
          <Button variant="outline" asChild>
            <Link href={routes.divisions()}>Clear filters</Link>
          </Button>
        }
      />
    ) : (
      <EmptyState
        title="No divisions yet"
        description="Every employee belongs to a division. Add the first one to start."
        action={<AddDivisionButton label="Add the first division" />}
      />
    );
  }

  const sortProps = (field: DivisionSortField) => {
    const active = filters.sort === field ? filters.order : null;
    const order = active === "asc" ? "desc" : "asc";
    return { active, href: divisionListHref({ ...filters, sort: field, order, page: 1 }) };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Code" {...sortProps("code")} />
              <SortHeader label="Name" {...sortProps("name")} />
              <TableHead scope="col" className="hidden text-right sm:table-cell">
                Active employees
              </TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((division) => (
              <TableRow key={division.id}>
                <TableCell className="font-mono">{division.code}</TableCell>
                <TableCell className="whitespace-normal">
                  {division.name}
                  <span className="block text-xs text-muted-foreground sm:hidden">
                    {division.activeEmployeeCount} active
                  </span>
                </TableCell>
                <TableCell className="hidden text-right tabular-nums sm:table-cell">
                  <Link
                    href={routes.employeesInDivision(division.id)}
                    className="underline-offset-4 hover:underline"
                    aria-label={`${division.activeEmployeeCount} active employees in ${division.name}`}
                  >
                    {division.activeEmployeeCount}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={division.status === "active" ? "secondary" : "outline"}>
                    {DIVISION_STATUS_LABEL[division.status]}
                  </Badge>
                </TableCell>
                <TableCell className="px-1">
                  <DivisionRowActions division={division} />
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
        hrefFor={(page) => divisionListHref({ ...filters, page })}
      />
    </div>
  );
}
