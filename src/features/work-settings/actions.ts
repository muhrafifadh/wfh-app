"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { routes } from "@/config/routes";
import {
  organizationSettingsSchema,
  scheduleFormSchema,
  schedulePreviewSchema,
  workScheduleSchema,
  workSettingsSchema,
  type SchedulePreview,
  type WorkSchedule,
  type WorkSettings,
} from "@/features/work-settings/schemas";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { expectedFailure, FIX_FIELDS } from "@/lib/api/action-errors";
import { apiFetch } from "@/lib/api/client";
import { can, requireUser } from "@/lib/auth/session";

/** Backend work-settings.errors.ts codes a user can act on. */
const MESSAGES = {
  SCHEDULE_EFFECTIVE_DATE_TOO_EARLY:
    "A new schedule can start tomorrow at the earliest (organization time).",
  SCHEDULE_PERIOD_OVERLAP:
    "Another schedule already starts on or after that date. Choose a later date.",
};

async function authorize(): Promise<ActionResult<never> | null> {
  const user = await requireUser();
  return can(user, "policy:manage")
    ? null
    : fail("You don't have permission to change attendance settings.");
}

export async function updateOrganizationSettingsAction(
  input: unknown,
): Promise<ActionResult<WorkSettings>> {
  const denied = await authorize();
  if (denied) return denied;

  const parsed = organizationSettingsSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  let settings: WorkSettings;
  try {
    settings = await apiFetch("/work-settings", {
      method: "PATCH",
      body: parsed.data,
      schema: workSettingsSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.attendanceSettings());
  // The support contact shows in every page's user menu
  revalidatePath("/", "layout");
  return ok(settings);
}

/** The boundaries a schedule would give, without saving it. */
export async function previewScheduleAction(
  input: unknown,
): Promise<ActionResult<SchedulePreview>> {
  const denied = await authorize();
  if (denied) return denied;

  const parsed = scheduleFormSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  try {
    return ok(
      await apiFetch("/work-schedules/preview", {
        method: "POST",
        body: parsed.data,
        schema: schedulePreviewSchema,
      }),
    );
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
}

/** Saves a new version from its effective date; history is never changed. */
export async function createScheduleAction(input: unknown): Promise<ActionResult<WorkSchedule>> {
  const denied = await authorize();
  if (denied) return denied;

  const parsed = scheduleFormSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  let created: WorkSchedule;
  try {
    created = await apiFetch("/work-schedules", {
      method: "POST",
      body: parsed.data,
      schema: workScheduleSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.attendanceSettings());
  return ok(created);
}
