import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeftIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { EditUserForm } from "@/features/users/components/edit-user-form";
import { UserRowActions } from "@/features/users/components/user-row-actions";
import { UserStatusBadge } from "@/features/users/components/user-status-badge";
import { getUser, listRoles } from "@/features/users/queries";
import { can, requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "User" };

export default async function UserPage({ params }: PageProps<"/users/[id]">) {
  const [{ id }, me] = await Promise.all([params, requireUser()]);
  if (!can(me, "user:read")) {
    return (
      <EmptyState
        title="You don't have access to users"
        description="Ask an admin for the user:read permission."
      />
    );
  }
  const canManage = can(me, "user:manage");
  const [user, roles] = await Promise.all([getUser(id), canManage ? listRoles() : []]);
  if (!user) notFound();
  const isSelf = user.id === me.id;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
        <Link href={routes.users()}>
          <ArrowLeftIcon aria-hidden />
          All users
        </Link>
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
        <UserStatusBadge status={user.status} />
        {canManage && (
          <div className="ml-auto">
            <UserRowActions user={user} isSelf={isSelf} />
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">
                {user.email}
                {!user.emailVerified && (
                  <span className="text-muted-foreground"> (not verified yet)</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd className="capitalize">{user.role.name}</dd>
              <dt className="text-muted-foreground">Added</dt>
              <dd>{formatDate(user.createdAt.slice(0, 10))}</dd>
            </dl>
          </CardContent>
        </Card>

        {canManage && (
          <Card>
            <CardHeader>
              <CardTitle>Edit</CardTitle>
              <CardDescription>Changes apply the next time they load a page.</CardDescription>
            </CardHeader>
            <CardContent>
              <EditUserForm user={user} roles={roles} isSelf={isSelf} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
