import type { Metadata } from "next";
import Link from "next/link";

import { ArrowLeftIcon } from "lucide-react";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { NewEmployeeForm } from "@/features/employees/components/employee-form";
import {
  listDivisionOptions,
  listManagerOptions,
  listRoleOptions,
} from "@/features/employees/queries";
import { getMeContext } from "@/features/profile/queries";
import { can, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Add employee" };

export default async function NewEmployeePage() {
  const user = await requireUser();
  if (!can(user, "employee:manage")) return <NoAccess title="Add employee" />;
  const [divisions, managers, roles, context] = await Promise.all([
    listDivisionOptions(),
    listManagerOptions(),
    // Giving the account a role needs user:manage (and listing roles user:read)
    can(user, "user:manage") ? listRoleOptions() : [],
    getMeContext(),
  ]);

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 self-start">
        <Link href={routes.employees()}>
          <ArrowLeftIcon aria-hidden />
          All employees
        </Link>
      </Button>
      <h1 className="text-2xl font-semibold tracking-tight">Add employee</h1>
      <NewEmployeeForm
        options={{ divisions, managers }}
        roles={roles}
        today={context.organization.workDate}
      />
    </>
  );
}
