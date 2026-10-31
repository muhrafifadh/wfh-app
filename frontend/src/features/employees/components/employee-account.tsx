"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SelectField } from "@/components/shared/select-field";
import { TextField } from "@/components/shared/text-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { roleLabel } from "@/config/roles";
import { routes } from "@/config/routes";
import {
  changeAccountRoleAction,
  inviteAccountAction,
  linkAccountAction,
  resendInvitationAction,
} from "@/features/employees/actions";
import { AccountStateBadge } from "@/features/employees/components/employee-badges";
import {
  accountRoleSchema,
  inviteAccountSchema,
  linkAccountSchema,
  type Employee,
  type InviteAccountInput,
  type LinkAccount,
  type LinkAccountInput,
  type RoleOption,
  type UserOption,
} from "@/features/employees/schemas";
import { applyServerErrors } from "@/lib/form-errors";

type EmployeeAccountProps = {
  employee: Employee;
  roles: RoleOption[];
  users: UserOption[];
  /** user:manage: invite, link and change roles. Without it the card is read-only. */
  canManageAccounts: boolean;
  /** The signed-in user's id: nobody changes their own role. */
  currentUserId: string;
};

const roleOptions = (roles: RoleOption[]) =>
  roles.map((role) => ({ value: role.id, label: roleLabel(role.name) }));

/** UX_FLOWS.md §12.3: the account, kept apart from employment information. */
export function EmployeeAccount(props: EmployeeAccountProps) {
  const { employee, canManageAccounts } = props;
  if (employee.account) return <LinkedAccount {...props} account={employee.account} />;
  if (!canManageAccounts) {
    return (
      <p className="text-sm text-muted-foreground">
        Not linked to an account yet. Someone who manages users can invite them.
      </p>
    );
  }
  return <NoAccount {...props} />;
}

function NoAccount({ employee, roles, users }: EmployeeAccountProps) {
  const [mode, setMode] = useState<"invite" | "link">("invite");
  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Not linked to an account yet, so they can&apos;t sign in or record attendance.
      </p>
      <RadioGroup
        value={mode}
        onValueChange={(value) => setMode(value === "link" ? "link" : "invite")}
        aria-label="How to give them an account"
        className="flex flex-wrap gap-4"
      >
        <Field orientation="horizontal" className="w-auto">
          <RadioGroupItem value="invite" id="account-mode-invite" />
          <FieldLabel htmlFor="account-mode-invite" className="font-normal">
            Invite by email
          </FieldLabel>
        </Field>
        <Field orientation="horizontal" className="w-auto">
          <RadioGroupItem value="link" id="account-mode-link" />
          <FieldLabel htmlFor="account-mode-link" className="font-normal">
            Link an existing account
          </FieldLabel>
        </Field>
      </RadioGroup>
      {mode === "invite" ? (
        <InviteForm employee={employee} roles={roles} />
      ) : (
        <LinkForm employee={employee} roles={roles} users={users} />
      )}
    </div>
  );
}

function InviteForm({ employee, roles }: Pick<EmployeeAccountProps, "employee" | "roles">) {
  const form = useForm<InviteAccountInput>({
    resolver: zodResolver(inviteAccountSchema),
    defaultValues: {
      email: employee.workEmail ?? "",
      roleId: roles.find((role) => role.name === "employee")?.id ?? "",
    },
  });
  const { isSubmitting, errors } = form.formState;

  async function handleSubmit(values: InviteAccountInput) {
    const result = await inviteAccountAction(employee.id, values);
    if (result.ok) {
      toast.success(`Invitation sent to ${values.email}`);
      return;
    }
    applyServerErrors(form, ["email", "roleId"], result.error, result.fieldErrors);
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="grid gap-4">
      <FieldGroup>
        {errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}
        <TextField
          control={form.control}
          name="email"
          label="Email"
          type="email"
          autoComplete="off"
          description="They'll get a link to set their password. It works for 7 days."
        />
        <SelectField
          control={form.control}
          name="roleId"
          label="Role"
          options={roleOptions(roles)}
        />
      </FieldGroup>
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send invitation"}
        </Button>
      </div>
    </form>
  );
}

function LinkForm({
  employee,
  roles,
  users,
}: Pick<EmployeeAccountProps, "employee" | "roles" | "users">) {
  const form = useForm<LinkAccountInput, unknown, LinkAccount>({
    resolver: zodResolver(linkAccountSchema),
    defaultValues: { userId: "", roleId: "" },
  });
  const { isSubmitting, errors } = form.formState;

  async function handleSubmit(values: LinkAccount) {
    const result = await linkAccountAction(employee.id, values);
    if (result.ok) {
      toast.success(`${employee.fullName} is now linked to ${result.data.account?.email}`);
      return;
    }
    applyServerErrors(form, ["userId", "roleId"], result.error, result.fieldErrors);
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="grid gap-4">
      <FieldGroup>
        {errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}
        <SelectField
          control={form.control}
          name="userId"
          label="Account"
          placeholder="Choose a user"
          options={users
            .filter((user) => user.status !== "deactivated")
            .map((user) => ({ value: user.id, label: `${user.name} (${user.email})` }))}
          description="Accounts that already belong to another employee can't be linked."
        />
        <SelectField
          control={form.control}
          name="roleId"
          label="Role"
          noneLabel="Keep their current role"
          options={roleOptions(roles)}
        />
      </FieldGroup>
      <div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Linking…" : "Link account"}
        </Button>
      </div>
    </form>
  );
}

function LinkedAccount({
  employee,
  account,
  roles,
  canManageAccounts,
  currentUserId,
}: EmployeeAccountProps & { account: NonNullable<Employee["account"]> }) {
  const [isResending, startResend] = useTransition();
  const [pendingRole, setPendingRole] = useState<string | null>(null);
  const isSelf = account.id === currentUserId;
  const form = useForm<{ roleId: string }>({
    resolver: zodResolver(accountRoleSchema),
    defaultValues: { roleId: account.role.id },
  });
  const nextRole = roles.find((role) => role.id === pendingRole);

  function resend() {
    startResend(async () => {
      const result = await resendInvitationAction(employee.id, account.id);
      if (result.ok) toast.success(`Invitation sent again to ${account.email}`);
      else toast.error(result.error);
    });
  }

  async function changeRole() {
    if (!pendingRole) return;
    const result = await changeAccountRoleAction(employee.id, account.id, { roleId: pendingRole });
    if (!result.ok) {
      toast.error(result.error);
      form.reset({ roleId: account.role.id });
      return;
    }
    toast.success(`Role changed to ${roleLabel(nextRole?.name ?? "")}`);
    form.reset({ roleId: pendingRole });
  }

  return (
    <div className="grid gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-muted-foreground">Email</dt>
        <dd className="break-all">{account.email}</dd>
        <dt className="text-muted-foreground">Sign-in</dt>
        <dd>
          <AccountStateBadge employee={employee} />
        </dd>
        <dt className="text-muted-foreground">Role</dt>
        <dd>{roleLabel(account.role.name)}</dd>
      </dl>
      {canManageAccounts && (
        <>
          {!isSelf && (
            <form
              noValidate
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={form.handleSubmit((values) => setPendingRole(values.roleId))}
            >
              <div className="sm:flex-1">
                <SelectField
                  control={form.control}
                  name="roleId"
                  label="Change role"
                  options={roleOptions(roles)}
                />
              </div>
              <Button type="submit" variant="outline" disabled={!form.formState.isDirty}>
                Change role
              </Button>
            </form>
          )}
          <div className="flex flex-wrap gap-2">
            {account.status === "invited" && (
              <Button variant="outline" onClick={resend} disabled={isResending}>
                {isResending ? "Sending…" : "Resend invitation"}
              </Button>
            )}
            <Button variant="ghost" asChild>
              <Link href={routes.user(account.id)}>Open in Users</Link>
            </Button>
          </div>
        </>
      )}
      <ConfirmDialog
        open={pendingRole !== null}
        onOpenChange={(open) => {
          if (open) return;
          setPendingRole(null);
        }}
        title={`Make ${employee.fullName} ${roleLabel(nextRole?.name ?? "")}?`}
        description="Their role decides what they can see and do: from their next page load, menus and access change to match."
        confirmLabel="Change role"
        pendingLabel="Changing…"
        onConfirm={changeRole}
      />
    </div>
  );
}
