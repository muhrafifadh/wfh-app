"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldPath, type FieldValues, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SelectField, type SelectOption } from "@/components/shared/select-field";
import { TextField } from "@/components/shared/text-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { roleLabel } from "@/config/roles";
import { routes } from "@/config/routes";
import { createEmployeeAction, updateEmployeeAction } from "@/features/employees/actions";
import {
  employeeDetailsSchema,
  newEmployeeFormSchema,
  type DivisionOption,
  type Employee,
  type EmployeeDetails,
  type EmployeeDetailsInput,
  type NewEmployeeForm,
  type NewEmployeeFormInput,
  type RoleOption,
} from "@/features/employees/schemas";
import { applyServerErrors } from "@/lib/form-errors";

type ManagerOption = { id: string; employeeNumber: string; fullName: string };

type Options = {
  divisions: DivisionOption[];
  managers: ManagerOption[];
};

const DETAIL_FIELDS = [
  "fullName",
  "workEmail",
  "jobTitle",
  "divisionId",
  "managerId",
  "employmentStartDate",
  "employmentEndDate",
] as const;

/** Active divisions can be chosen; the current one stays listed even if inactive. */
const divisionOptions = (divisions: DivisionOption[], currentId?: string): SelectOption[] =>
  divisions
    .filter((d) => d.status === "active" || d.id === currentId)
    .map((d) => ({
      value: d.id,
      label: d.status === "active" ? d.name : `${d.name} (inactive)`,
      disabled: d.status !== "active",
    }));

const managerOptions = (managers: ManagerOption[], exceptId?: string): SelectOption[] =>
  managers
    .filter((m) => m.id !== exceptId)
    .map((m) => ({ value: m.id, label: `${m.fullName} (${m.employeeNumber})` }));

/** The employment fields shared by the add and edit forms. */
function DetailFields<T extends FieldValues, O extends FieldValues>({
  form,
  options,
  employee,
}: {
  form: UseFormReturn<T, unknown, O>;
  options: Options;
  employee?: Employee;
}) {
  const name = (field: string) => field as FieldPath<T>;
  return (
    <>
      <TextField
        control={form.control}
        name={name("fullName")}
        label="Full name"
        autoComplete="off"
      />
      <TextField
        control={form.control}
        name={name("workEmail")}
        label="Work email"
        type="email"
        autoComplete="off"
        description="Optional. Also the email their account signs in with."
      />
      <TextField
        control={form.control}
        name={name("jobTitle")}
        label="Job title (optional)"
        autoComplete="off"
      />
      <SelectField
        control={form.control}
        name={name("divisionId")}
        label="Division"
        placeholder="Choose a division"
        options={divisionOptions(options.divisions, employee?.division.id)}
      />
      <SelectField
        control={form.control}
        name={name("managerId")}
        label="Direct manager"
        noneLabel="No manager"
        options={managerOptions(options.managers, employee?.id)}
        description="Reviews their corrections and sees their attendance."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          control={form.control}
          name={name("employmentStartDate")}
          label="Employment start date"
          type="date"
        />
        <TextField
          control={form.control}
          name={name("employmentEndDate")}
          label="End date (optional)"
          type="date"
        />
      </div>
    </>
  );
}

/** UX_FLOWS.md §12.2 — add an employee and, optionally, give them an account. */
export function NewEmployeeForm({
  options,
  roles,
  today,
}: {
  options: Options;
  /** Empty when the caller can't manage accounts: the role field is then hidden. */
  roles: RoleOption[];
  today: string;
}) {
  const router = useRouter();
  const employeeRole = roles.find((role) => role.name === "employee");
  const form = useForm<NewEmployeeFormInput, unknown, NewEmployeeForm>({
    resolver: zodResolver(newEmployeeFormSchema),
    defaultValues: {
      employeeNumber: "",
      fullName: "",
      workEmail: "",
      jobTitle: "",
      divisionId: "",
      managerId: "",
      employmentStartDate: today,
      employmentEndDate: "",
      roleId: employeeRole?.id ?? "",
    },
  });
  const { isSubmitting, errors } = form.formState;

  async function handleSubmit(values: NewEmployeeForm) {
    const result = await createEmployeeAction(values);
    if (!result.ok) {
      applyServerErrors(
        form,
        ["employeeNumber", ...DETAIL_FIELDS, "roleId"],
        result.error,
        result.fieldErrors,
      );
      return;
    }
    const { employee, account } = result.data;
    toast.success(`${employee.fullName} was added`);
    if (account.kind === "invited") toast.success(`Invitation sent to ${account.email}`);
    if (account.kind === "linked") toast.success(`Linked to the existing account ${account.email}`);
    if (account.kind === "failed") {
      toast.error(`The employee was saved, but no account was set up: ${account.error}`);
    }
    router.push(routes.employee(employee.id));
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="grid max-w-2xl gap-6">
      {errors.root && (
        <Alert variant="destructive">
          <AlertDescription>{errors.root.message}</AlertDescription>
        </Alert>
      )}
      <FieldSet>
        <FieldLegend>Employment</FieldLegend>
        <FieldGroup>
          <TextField
            control={form.control}
            name="employeeNumber"
            label="Employee number"
            autoComplete="off"
            description="For example EMP-011. Saved in uppercase and can't be changed later."
            inputProps={{
              onBlur: (event) =>
                form.setValue("employeeNumber", event.target.value.trim().toUpperCase()),
            }}
          />
          <DetailFields form={form} options={options} />
        </FieldGroup>
      </FieldSet>
      {roles.length > 0 && (
        <FieldSet>
          <FieldLegend>Account</FieldLegend>
          <FieldGroup>
            <SelectField
              control={form.control}
              name="roleId"
              label="Account role"
              noneLabel="No account yet"
              options={roles.map((role) => ({ value: role.id, label: roleLabel(role.name) }))}
              description="With a role and a work email, an existing account with that email is linked; otherwise they get an email invitation to set a password (valid 7 days)."
            />
          </FieldGroup>
        </FieldSet>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Adding…" : "Add employee"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(routes.employees())}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** UX_FLOWS.md §12.3 — edit employment details; access-changing edits ask first. */
export function EditEmployeeForm({ employee, options }: { employee: Employee; options: Options }) {
  const [pending, setPending] = useState<EmployeeDetails | null>(null);
  const form = useForm<EmployeeDetailsInput, unknown, EmployeeDetails>({
    resolver: zodResolver(employeeDetailsSchema),
    defaultValues: {
      fullName: employee.fullName,
      workEmail: employee.workEmail ?? "",
      jobTitle: employee.jobTitle ?? "",
      divisionId: employee.division.id,
      managerId: employee.manager?.id ?? "",
      employmentStartDate: employee.employmentStartDate,
      employmentEndDate: employee.employmentEndDate ?? "",
    },
  });
  const { isSubmitting, isDirty, errors } = form.formState;

  async function save(values: EmployeeDetails): Promise<boolean> {
    const result = await updateEmployeeAction(employee.id, values);
    if (!result.ok) {
      applyServerErrors(form, DETAIL_FIELDS, result.error, result.fieldErrors);
      return true; // close the confirmation; the errors show on the form
    }
    toast.success("Changes saved");
    form.reset(form.getValues());
    return true;
  }

  async function handleSubmit(values: EmployeeDetails) {
    const affectsAccess =
      values.divisionId !== employee.division.id ||
      (values.managerId ?? null) !== (employee.manager?.id ?? null);
    if (affectsAccess) setPending(values);
    else await save(values);
  }

  const accessChanges = pending ? describeAccessChanges(employee, pending, options) : [];

  return (
    <>
      <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="grid gap-6">
        {errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}
        <FieldGroup>
          <DetailFields form={form} options={options} employee={employee} />
        </FieldGroup>
        <div>
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Change who oversees this employee?"
        description={
          <span className="grid gap-2">
            {accessChanges.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </span>
        }
        confirmLabel="Save changes"
        pendingLabel="Saving…"
        onConfirm={async () => {
          if (pending) await save(pending);
        }}
      />
    </>
  );
}

function describeAccessChanges(employee: Employee, next: EmployeeDetails, options: Options) {
  const lines: string[] = [];
  if (next.divisionId !== employee.division.id) {
    const division = options.divisions.find((d) => d.id === next.divisionId);
    lines.push(
      `Division: ${employee.division.name} → ${division?.name ?? "another division"}. Reports filtered by division will list them under the new one, including past days.`,
    );
  }
  if ((next.managerId ?? null) !== (employee.manager?.id ?? null)) {
    const manager = options.managers.find((m) => m.id === next.managerId);
    lines.push(
      `Manager: ${employee.manager?.fullName ?? "none"} → ${manager?.fullName ?? "none"}. The new manager sees their attendance and decides their corrections; the old one no longer does.`,
    );
  }
  return lines;
}
