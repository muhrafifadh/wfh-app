import type { Metadata } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { roleLabel } from "@/config/roles";
import { EmployeeProfileCard } from "@/features/profile/components/employee-profile-card";
import { SupportContact } from "@/features/profile/components/support-contact";
import { getMeContext, getMyEmployee } from "@/features/profile/queries";
import { requireUser } from "@/lib/auth/session";
import { timeZoneLabel } from "@/lib/time-zone";

export const metadata: Metadata = { title: "My profile" };

// UX_FLOWS.md §4: any signed-in user may see their own profile.
export default async function ProfilePage() {
  const user = await requireUser();
  const [context, employee] = await Promise.all([getMeContext(), getMyEmployee()]);
  const { organization } = context;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">My profile</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd>{user.name}</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">
                {user.email}
                {!user.emailVerified && (
                  <span className="text-muted-foreground"> (not verified yet)</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd>{roleLabel(user.role.name)}</dd>
              <dt className="text-muted-foreground">Organization</dt>
              <dd>{organization.name}</dd>
              <dt className="text-muted-foreground">Time zone</dt>
              <dd>
                {timeZoneLabel(organization.timezone)} ({organization.timezone})
              </dd>
              <dt className="text-muted-foreground">Help</dt>
              <dd>
                <SupportContact contact={organization.supportContact} />
              </dd>
            </dl>
          </CardContent>
        </Card>
        <EmployeeProfileCard employee={employee} supportContact={organization.supportContact} />
      </div>
    </>
  );
}
