"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { routes } from "@/config/routes";
import {
  inviteUserSchema,
  updateUserSchema,
  userIdSchema,
  userSchema,
  type User,
} from "@/features/users/schemas";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { can, requireUser } from "@/lib/auth/session";

const FIX_FIELDS = "Please fix the highlighted fields.";
const NO_PERMISSION = "You don't have permission to manage users.";

/** Backend error codes users can act on (backend users.errors.ts). Everything else throws. */
function expectedFailure(error: unknown): ActionResult<never> {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "EMAIL_TAKEN":
        return fail("An account with this email already exists.", error.fieldErrors);
      case "CANNOT_CHANGE_OWN_ACCOUNT":
      case "USER_NOT_INVITED":
        return fail(error.message);
      case "NOT_FOUND":
        return fail("That user or role no longer exists. Refresh and try again.");
      case "FORBIDDEN":
        return fail(NO_PERMISSION);
    }
    if (error.status === 400 && error.fieldErrors) return fail(FIX_FIELDS, error.fieldErrors);
  }
  throw error;
}

/** Steps 1–2 of docs/09-server-actions.md for actions on one user. */
async function authorize(): Promise<ActionResult<never> | null> {
  const user = await requireUser();
  return can(user, "user:manage") ? null : fail(NO_PERMISSION);
}

export async function inviteUserAction(input: unknown): Promise<ActionResult<User>> {
  const denied = await authorize();
  if (denied) return denied;

  const parsed = inviteUserSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  let invited: User;
  try {
    invited = await apiFetch("/users", { method: "POST", body: parsed.data, schema: userSchema });
  } catch (error) {
    return expectedFailure(error);
  }
  revalidatePath(routes.users());
  return ok(invited);
}

export async function updateUserAction(id: unknown, input: unknown): Promise<ActionResult<User>> {
  const denied = await authorize();
  if (denied) return denied;

  const userId = userIdSchema.safeParse(id);
  const parsed = updateUserSchema.safeParse(input);
  if (!userId.success) return fail("That user no longer exists.");
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  let updated: User;
  try {
    updated = await apiFetch(`/users/${userId.data}`, {
      method: "PATCH",
      body: parsed.data,
      schema: userSchema,
    });
  } catch (error) {
    return expectedFailure(error);
  }
  revalidatePath(routes.users());
  revalidatePath(routes.user(userId.data));
  return ok(updated);
}

/** POST /users/:id/<action> → the updated user. */
async function userAction(
  id: unknown,
  action: "deactivate" | "reactivate" | "invitation",
): Promise<ActionResult<User>> {
  const denied = await authorize();
  if (denied) return denied;

  const userId = userIdSchema.safeParse(id);
  if (!userId.success) return fail("That user no longer exists.");

  let user: User;
  try {
    user = await apiFetch(`/users/${userId.data}/${action}`, {
      method: "POST",
      schema: userSchema,
    });
  } catch (error) {
    return expectedFailure(error);
  }
  revalidatePath(routes.users());
  revalidatePath(routes.user(userId.data));
  return ok(user);
}

export async function deactivateUserAction(id: unknown): Promise<ActionResult<User>> {
  return userAction(id, "deactivate");
}

export async function reactivateUserAction(id: unknown): Promise<ActionResult<User>> {
  return userAction(id, "reactivate");
}

export async function resendInvitationAction(id: unknown): Promise<ActionResult<User>> {
  return userAction(id, "invitation");
}
