"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { routes } from "@/config/routes";
import {
  holidayFormSchema,
  holidayIdSchema,
  holidaySchema,
  type Holiday,
} from "@/features/holidays/schemas";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { expectedFailure, FIX_FIELDS } from "@/lib/api/action-errors";
import { apiFetch } from "@/lib/api/client";
import { can, requireUser } from "@/lib/auth/session";

const GONE = "That holiday no longer exists. Refresh and try again.";

/** Backend holidays.errors.ts codes a user can act on. */
const MESSAGES = {
  HOLIDAY_DATE_CONFLICT: "There's already a holiday on this date.",
  NOT_FOUND: GONE,
};

async function authorize(): Promise<ActionResult<never> | null> {
  const user = await requireUser();
  return can(user, "holiday:manage") ? null : fail("You don't have permission to manage holidays.");
}

export async function createHolidayAction(input: unknown): Promise<ActionResult<Holiday>> {
  const denied = await authorize();
  if (denied) return denied;

  const parsed = holidayFormSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  let created: Holiday;
  try {
    created = await apiFetch("/holidays", {
      method: "POST",
      body: parsed.data,
      schema: holidaySchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.holidays());
  return ok(created);
}

export async function updateHolidayAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<Holiday>> {
  const denied = await authorize();
  if (denied) return denied;

  const holidayId = holidayIdSchema.safeParse(id);
  const parsed = holidayFormSchema.safeParse(input);
  if (!holidayId.success) return fail(GONE);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  let updated: Holiday;
  try {
    updated = await apiFetch(`/holidays/${holidayId.data}`, {
      method: "PATCH",
      body: parsed.data,
      schema: holidaySchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.holidays());
  return ok(updated);
}

/** Soft delete on the backend: the entry stays in the audit log. */
export async function deleteHolidayAction(id: unknown): Promise<ActionResult<void>> {
  const denied = await authorize();
  if (denied) return denied;

  const holidayId = holidayIdSchema.safeParse(id);
  if (!holidayId.success) return fail(GONE);

  try {
    await apiFetch(`/holidays/${holidayId.data}`, { method: "DELETE", schema: z.unknown() });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.holidays());
  return ok(undefined);
}
