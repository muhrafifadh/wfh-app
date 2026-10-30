import { Badge } from "@/components/ui/badge";
import { EMPLOYEE_STATUS_LABEL } from "@/features/employees/constants";
import {
  ACCOUNT_STATE_LABEL,
  accountStateOf,
  employmentEnded,
} from "@/features/employees/employee-states";
import type { Employee } from "@/features/employees/schemas";

const ACCOUNT_VARIANT = {
  none: "outline",
  invited: "outline",
  active: "secondary",
  deactivated: "outline",
} as const;

/** The linked account's state, in words (UX_FLOWS.md §12.4). */
export function AccountStateBadge({ employee }: { employee: Pick<Employee, "account"> }) {
  const state = accountStateOf(employee);
  return <Badge variant={ACCOUNT_VARIANT[state]}>{ACCOUNT_STATE_LABEL[state]}</Badge>;
}

/** The employee's own status, plus "Employment ended" when the end date has passed. */
export function EmployeeStatusBadges({
  employee,
  today,
}: {
  employee: Pick<Employee, "status" | "employmentEndDate">;
  today: string;
}) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge variant={employee.status === "active" ? "secondary" : "outline"}>
        {EMPLOYEE_STATUS_LABEL[employee.status]}
      </Badge>
      {employmentEnded(employee, today) && <Badge variant="outline">Employment ended</Badge>}
    </span>
  );
}
