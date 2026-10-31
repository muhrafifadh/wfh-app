import type { Metadata } from "next";
import { Suspense } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { InviteUserDialog } from "@/features/users/components/invite-user-dialog";
import { UserFilters } from "@/features/users/components/user-filters";
import { UserTable } from "@/features/users/components/user-table";
import {
  UserFiltersSkeleton,
  UserTableSkeleton,
} from "@/features/users/components/user-table-skeleton";
import { listRoles } from "@/features/users/queries";
import { loadUserSearchParams } from "@/features/users/search-params";
import { can, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/users">) {
  const user = await requireUser();
  if (!can(user, "user:read")) {
    return (
      <EmptyState
        title="You don't have access to users"
        description="Ask an admin for the user:read permission."
      />
    );
  }
  const canManage = can(user, "user:manage");
  const roles = canManage ? await listRoles() : [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        {canManage && (
          <div className="ml-auto">
            <InviteUserDialog roles={roles} />
          </div>
        )}
      </div>
      <Suspense fallback={<UserFiltersSkeleton />}>
        <UserFilters />
      </Suspense>
      <Suspense fallback={<UserTableSkeleton />}>
        <UserResults searchParams={searchParams} canManage={canManage} currentUserId={user.id} />
      </Suspense>
    </>
  );
}

async function UserResults({
  searchParams,
  canManage,
  currentUserId,
}: Pick<PageProps<"/users">, "searchParams"> & { canManage: boolean; currentUserId: string }) {
  const filters = await loadUserSearchParams(searchParams);
  return <UserTable filters={filters} canManage={canManage} currentUserId={currentUserId} />;
}
