import Link from "next/link";

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
import { UserRowActions } from "@/features/users/components/user-row-actions";
import { UserStatusBadge } from "@/features/users/components/user-status-badge";
import type { UserSortField } from "@/features/users/constants";
import { listUsers } from "@/features/users/queries";
import { userListHref, type UserFilters } from "@/features/users/search-params";
import { formatDate } from "@/lib/format";

type UserTableProps = {
  filters: UserFilters;
  /** Shows the row actions (the actions check user:manage again on the server). */
  canManage: boolean;
  currentUserId: string;
};

export async function UserTable({ filters, canManage, currentUserId }: UserTableProps) {
  const result = await listUsers(filters);

  if (result.total === 0) {
    return (
      <EmptyState
        title="No users match your filters"
        description="Try a different search or status."
        action={
          <Button variant="outline" asChild>
            <Link href={routes.users()}>Clear filters</Link>
          </Button>
        }
      />
    );
  }

  const sortProps = (field: UserSortField) => {
    const active = filters.sort === field ? filters.order : null;
    const order = active === "asc" ? "desc" : "asc";
    return { active, href: userListHref({ ...filters, sort: field, order, page: 1 }) };
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Name" {...sortProps("name")} />
              <TableHead scope="col" className="hidden sm:table-cell">
                Role
              </TableHead>
              <TableHead scope="col">Status</TableHead>
              <SortHeader
                label="Added"
                {...sortProps("createdAt")}
                className="hidden md:table-cell"
              />
              {canManage && (
                <TableHead scope="col" className="w-10">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="whitespace-normal">
                  <Link
                    href={routes.user(user.id)}
                    className="block font-medium underline-offset-4 hover:underline"
                  >
                    {user.name}
                    {user.id === currentUserId && (
                      <span className="font-normal text-muted-foreground"> (you)</span>
                    )}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{user.email}</span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{roleLabel(user.role.name)}</TableCell>
                <TableCell>
                  <UserStatusBadge status={user.status} />
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {formatDate(user.createdAt.slice(0, 10))}
                </TableCell>
                {canManage && (
                  <TableCell className="px-1">
                    <UserRowActions
                      user={{ id: user.id, name: user.name, status: user.status }}
                      isSelf={user.id === currentUserId}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ListPagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        hrefFor={(page) => userListHref({ ...filters, page })}
      />
    </div>
  );
}
