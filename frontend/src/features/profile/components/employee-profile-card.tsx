import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SupportContact } from "@/features/profile/components/support-contact";
import type { MyEmployee } from "@/features/profile/schemas";
import { formatDate } from "@/lib/format";

const EMPTY = "—";

/** The caller's employee record, or why attendance isn't available without one. */
export function EmployeeProfileCard({
  employee,
  supportContact,
}: {
  employee: MyEmployee | null;
  supportContact: string | null;
}) {
  if (!employee) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Employee profile</CardTitle>
          <CardDescription>
            Your account isn&apos;t linked to an employee profile, so you don&apos;t record
            attendance. If you should, contact <SupportContact contact={supportContact} />.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Employee profile
          <Badge variant={employee.status === "active" ? "secondary" : "outline"}>
            {employee.status === "active" ? "Active" : "Inactive"}
          </Badge>
        </CardTitle>
        <CardDescription>Ask Admin/HR to correct anything here.</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Employee number</dt>
          <dd className="font-mono">{employee.employeeNumber}</dd>
          <dt className="text-muted-foreground">Full name</dt>
          <dd>{employee.fullName}</dd>
          <dt className="text-muted-foreground">Job title</dt>
          <dd>{employee.jobTitle ?? EMPTY}</dd>
          <dt className="text-muted-foreground">Division</dt>
          <dd>{employee.division.name}</dd>
          <dt className="text-muted-foreground">Manager</dt>
          <dd>{employee.manager?.fullName ?? EMPTY}</dd>
          <dt className="text-muted-foreground">Work email</dt>
          <dd className="break-all">{employee.workEmail ?? EMPTY}</dd>
          <dt className="text-muted-foreground">Employed since</dt>
          <dd>{formatDate(employee.employmentStartDate)}</dd>
          {employee.employmentEndDate && (
            <>
              <dt className="text-muted-foreground">Employed until</dt>
              <dd>{formatDate(employee.employmentEndDate)}</dd>
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
