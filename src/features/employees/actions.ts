"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { routes } from "@/config/routes";
import {
  accountRoleSchema,
  employeeDetailsSchema,
  employeeIdSchema,
  employeeSchema,
  inviteAccountSchema,
  linkAccountSchema,
  newEmployeeFormSchema,
  userOptionsSchema,
  type Employee,
} from "@/features/employees/schemas";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { expectedFailure, FIX_FIELDS } from "@/lib/api/action-errors";
import { apiFetch } from "@/lib/api/client";
import type { ApiSchema } from "@/lib/api/contract";
import { ApiError } from "@/lib/api/errors";
import { can, requireUser } from "@/lib/auth/session";

const NO_PERMISSION = "You don't have permission to manage employees.";
const GONE = "That employee no longer exists. Refresh and try again.";

/** Backend employees.errors.ts and users.errors.ts codes a user can act on. */
const MESSAGES = {
  EMPLOYEE_NUMBER_TAKEN: "Another employee already has this number.",
  REPORTING_LINE_CYCLE: "That manager reports to this employee, directly or indirectly.",
  DIVISION_INACTIVE: "That division is inactive. Choose another one or reactivate it.",
  MANAGER_INACTIVE: "That manager is inactive. Choose an active employee.",
  EMPLOYMENT_PERIOD_INVALID: "The end date can't be before the start date.",
  EMPLOYEE_HAS_ACCOUNT: "This employee already has an account.",
  USER_HAS_EMPLOYEE: "That account already belongs to another employee.",
  EMAIL_TAKEN: "An account with this email already exists.",
  CANNOT_CHANGE_OWN_ACCOUNT: "You can't change your own role.",
  USER_NOT_INVITED: "That account has already accepted its invitation.",
  NOT_FOUND: "Something it refers to no longer exists. Refresh and try again.",
};

type Denied = ActionResult<never>;

/** Steps 1–2 of docs/09-server-actions.md, for one permission. */
async function authorize(permission: "employee:manage" | "user:manage"): Promise<Denied | null> {
  const user = await requireUser();
  if (can(user, permission)) return null;
  return fail(
    permission === "user:manage" ? "You don't have permission to manage accounts." : NO_PERMISSION,
  );
}

function revalidateEmployee(id: string) {
  revalidatePath(routes.employees());
  revalidatePath(routes.employee(id));
}

/** What happened to the new employee's account (UX_FLOWS.md §12.2). */
export type AccountOutcome =
  | { kind: "none" }
  | { kind: "invited"; email: string }
  | { kind: "linked"; email: string }
  | { kind: "failed"; error: string };

/**
 * Creates the employee, then gives them an account when a role was chosen: links the
 * existing user with that email, or invites a new one. The employee is kept if only
 * the account step fails; the detail page then offers it again.
 */
export async function createEmployeeAction(
  input: unknown,
): Promise<ActionResult<{ employee: Employee; account: AccountOutcome }>> {
  const denied = await authorize("employee:manage");
  if (denied) return denied;

  const parsed = newEmployeeFormSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);
  const { roleId, ...body } = parsed.data;

  let employee: Employee;
  try {
    employee = await apiFetch("/employees", { method: "POST", body, schema: employeeSchema });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.employees());

  if (!roleId || !body.workEmail) return ok({ employee, account: { kind: "none" } });
  const account = await giveAccount(employee.id, body.workEmail, roleId);
  revalidateEmployee(employee.id);
  return ok({ employee: account.employee ?? employee, account: account.outcome });
}

async function giveAccount(
  employeeId: string,
  email: string,
  roleId: string,
): Promise<{ employee?: Employee; outcome: AccountOutcome }> {
  const user = await requireUser();
  if (!can(user, "user:manage")) {
    return { outcome: { kind: "failed", error: "You don't have permission to create accounts." } };
  }
  try {
    const existing = await findUserByEmail(email);
    const body: ApiSchema<"LinkAccountDto"> = existing
      ? { mode: "link", userId: existing.id, roleId }
      : { mode: "invite", email, roleId };
    const employee = await apiFetch(`/employees/${employeeId}/account`, {
      method: "POST",
      body,
      schema: employeeSchema,
    });
    return { employee, outcome: { kind: existing ? "linked" : "invited", email } };
  } catch (error) {
    const result = expectedFailure(error, MESSAGES);
    return { outcome: { kind: "failed", error: result.ok ? "" : result.error } };
  }
}

/** The organization's user with exactly this email, if any (the search also matches names). */
async function findUserByEmail(email: string) {
  const params = new URLSearchParams({ q: email, pageSize: "10" });
  const { items } = await apiFetch(`/users?${params}`, { schema: userOptionsSchema });
  return items.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function updateEmployeeAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<Employee>> {
  const denied = await authorize("employee:manage");
  if (denied) return denied;

  const employeeId = employeeIdSchema.safeParse(id);
  const parsed = employeeDetailsSchema.safeParse(input);
  if (!employeeId.success) return fail(GONE);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  let updated: Employee;
  try {
    updated = await apiFetch(`/employees/${employeeId.data}`, {
      method: "PATCH",
      body: parsed.data,
      schema: employeeSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidateEmployee(employeeId.data);
  return ok(updated);
}

async function setStatus(
  id: unknown,
  action: "deactivate" | "reactivate",
): Promise<ActionResult<Employee>> {
  const denied = await authorize("employee:manage");
  if (denied) return denied;

  const employeeId = employeeIdSchema.safeParse(id);
  if (!employeeId.success) return fail(GONE);

  let employee: Employee;
  try {
    employee = await apiFetch(`/employees/${employeeId.data}/${action}`, {
      method: "POST",
      schema: employeeSchema,
    });
  } catch (error) {
    return expectedFailure(error, { ...MESSAGES, NOT_FOUND: GONE });
  }
  revalidateEmployee(employeeId.data);
  return ok(employee);
}

export async function deactivateEmployeeAction(id: unknown): Promise<ActionResult<Employee>> {
  return setStatus(id, "deactivate");
}

export async function reactivateEmployeeAction(id: unknown): Promise<ActionResult<Employee>> {
  return setStatus(id, "reactivate");
}

/** POST /employees/:id/account. Needs both permissions: it creates or changes a user. */
async function accountAction(
  id: unknown,
  body: ApiSchema<"LinkAccountDto">,
): Promise<ActionResult<Employee>> {
  const denied = (await authorize("employee:manage")) ?? (await authorize("user:manage"));
  if (denied) return denied;

  const employeeId = employeeIdSchema.safeParse(id);
  if (!employeeId.success) return fail(GONE);

  let employee: Employee;
  try {
    employee = await apiFetch(`/employees/${employeeId.data}/account`, {
      method: "POST",
      body,
      schema: employeeSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidateEmployee(employeeId.data);
  revalidatePath(routes.users());
  return ok(employee);
}

export async function inviteAccountAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<Employee>> {
  const parsed = inviteAccountSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);
  return accountAction(id, { mode: "invite", ...parsed.data });
}

export async function linkAccountAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<Employee>> {
  const parsed = linkAccountSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);
  const { userId, roleId } = parsed.data;
  return accountAction(id, { mode: "link", userId, ...(roleId && { roleId }) });
}

/** Changes the linked user's role (PATCH /users/:id). */
export async function changeAccountRoleAction(
  employeeId: unknown,
  userId: unknown,
  input: unknown,
): Promise<ActionResult<void>> {
  const denied = await authorize("user:manage");
  if (denied) return denied;

  const ids = z.tuple([employeeIdSchema, z.uuid()]).safeParse([employeeId, userId]);
  const parsed = accountRoleSchema.safeParse(input);
  if (!ids.success) return fail(GONE);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  try {
    await apiFetch(`/users/${ids.data[1]}`, {
      method: "PATCH",
      body: parsed.data,
      schema: z.unknown(),
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidateEmployee(ids.data[0]);
  revalidatePath(routes.user(ids.data[1]));
  return ok(undefined);
}

/** Sends the invitation email again (POST /users/:id/invitation). */
export async function resendInvitationAction(
  employeeId: unknown,
  userId: unknown,
): Promise<ActionResult<void>> {
  const denied = await authorize("user:manage");
  if (denied) return denied;

  const ids = z.tuple([employeeIdSchema, z.uuid()]).safeParse([employeeId, userId]);
  if (!ids.success) return fail(GONE);

  try {
    await apiFetch(`/users/${ids.data[1]}/invitation`, { method: "POST", schema: z.unknown() });
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      return fail("An invitation was sent recently. Try again later.");
    }
    return expectedFailure(error, MESSAGES);
  }
  revalidateEmployee(ids.data[0]);
  return ok(undefined);
}
