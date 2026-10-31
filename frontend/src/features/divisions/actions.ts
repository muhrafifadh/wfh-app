"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { routes } from "@/config/routes";
import {
  divisionFormSchema,
  divisionIdSchema,
  divisionSchema,
  type Division,
} from "@/features/divisions/schemas";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { expectedFailure, FIX_FIELDS } from "@/lib/api/action-errors";
import { apiFetch } from "@/lib/api/client";
import { can, requireUser } from "@/lib/auth/session";

const NO_PERMISSION = "You don't have permission to manage divisions.";
const GONE = "That division no longer exists. Refresh and try again.";

/** Backend divisions.errors.ts codes a user can act on. */
const MESSAGES = {
  DIVISION_CODE_TAKEN: "Another division already uses this code.",
  DIVISION_NAME_TAKEN: "Another division already has this name.",
  DIVISION_HAS_ACTIVE_EMPLOYEES:
    "This division still has active employees. Move them to another division first.",
  NOT_FOUND: GONE,
};

async function authorize(): Promise<ActionResult<never> | null> {
  const user = await requireUser();
  return can(user, "division:manage") ? null : fail(NO_PERMISSION);
}

export async function createDivisionAction(input: unknown): Promise<ActionResult<Division>> {
  const denied = await authorize();
  if (denied) return denied;

  const parsed = divisionFormSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  let created: Division;
  try {
    created = await apiFetch("/divisions", {
      method: "POST",
      body: parsed.data,
      schema: divisionSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.divisions());
  return ok(created);
}

export async function updateDivisionAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<Division>> {
  const denied = await authorize();
  if (denied) return denied;

  const divisionId = divisionIdSchema.safeParse(id);
  const parsed = divisionFormSchema.safeParse(input);
  if (!divisionId.success) return fail(GONE);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  let updated: Division;
  try {
    updated = await apiFetch(`/divisions/${divisionId.data}`, {
      method: "PATCH",
      body: parsed.data,
      schema: divisionSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.divisions());
  return ok(updated);
}

async function setStatus(
  id: unknown,
  action: "deactivate" | "reactivate",
): Promise<ActionResult<Division>> {
  const denied = await authorize();
  if (denied) return denied;

  const divisionId = divisionIdSchema.safeParse(id);
  if (!divisionId.success) return fail(GONE);

  let division: Division;
  try {
    division = await apiFetch(`/divisions/${divisionId.data}/${action}`, {
      method: "POST",
      schema: divisionSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.divisions());
  return ok(division);
}

export async function deactivateDivisionAction(id: unknown): Promise<ActionResult<Division>> {
  return setStatus(id, "deactivate");
}

export async function reactivateDivisionAction(id: unknown): Promise<ActionResult<Division>> {
  return setStatus(id, "reactivate");
}
