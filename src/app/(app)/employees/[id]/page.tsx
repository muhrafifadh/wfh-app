import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeftIcon, InfoIcon } from "lucide-react";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { EmployeeAccount } from "@/features/employees/components/employee-account";
import { EmployeeStatusBadges } from "@/features/employees/components/employee-badges";
import { EditEmployeeForm } from "@/features/employees/components/employee-form";
import { EmployeeStatusAction } from "@/features/employees/components/employee-status-action";
import { employeeNotices } from "@/features/employees/employee-states";
import {
  getEmployee,
  listDivisionOptions,
  listManagerOptions,
  listRoleOptions,
  listUserOptions,
} from "@/features/employees/queries";
import { getMeContext } from "@/features/profile/queries";
import { can, requireUser } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { formatDateTimeIn } from "@/lib/time-zone";

export const metadata: Metadata = { title: "Employee" };

export default async function EmployeePage({ params }: PageProps<"/employees/[id]">) {
  const [{ id }, user] = await Promise.all([params, requireUser()]);
  if (!can(user, "employee:manage")) return <NoAccess title="Employee" />;
  const canManageAccounts = can(user, "user:manage");
  const [employee, divisions, managers, roles, users, context] = await Promise.all([
    getEmployee(id),
    listDivisionOptions(),
    listManagerOptions(),
    canManageAccounts ? listRoleOptions() : [],
    canManageAccounts ? listUserOptions() : [],
    getMeContext(),
  ]);
  if (!employee) notFound();
  const today = context.organization.workDate;
  const notices = employeeNotices(employee, today);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
        <Link href={routes.employees()}>
          <ArrowLeftIcon aria-hidden />
          All employees
        </Link>
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{employee.fullName}</h1>
        <span className="font-mono text-sm text-muted-foreground">{employee.employeeNumber}</span>
        <EmployeeStatusBadges employee={employee} today={today} />
        <div className="ml-auto">
          <EmployeeStatusAction employee={employee} />
        </div>
      </div>
      {notices.length > 0 && (
        <Alert>
          <InfoIcon aria-hidden />
          <AlertDescription>
            <ul className="grid gap-1">
              {notices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Employment</CardTitle>
            <CardDescription>
              Added{" "}
              <time dateTime={employee.createdAt} title={formatDateTime(employee.createdAt)}>
                {formatDateTimeIn(employee.createdAt, context.organization.timezone)}
              </time>{" "}
              · last changed{" "}
              <time dateTime={employee.updatedAt} title={formatDateTime(employee.updatedAt)}>
                {formatDateTimeIn(employee.updatedAt, context.organization.timezone)}
              </time>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EditEmployeeForm employee={employee} options={{ divisions, managers }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>How they sign in, and what their role lets them do.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmployeeAccount
              employee={employee}
              roles={roles}
              users={users}
              canManageAccounts={canManageAccounts}
              currentUserId={user.id}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
