"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { routes } from "@/config/routes";
import {
  emailPreferencesSchema,
  markAllReadSchema,
  notificationIdSchema,
  type EmailPreferences,
} from "@/features/notifications/schemas";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { expectedFailure, FIX_FIELDS } from "@/lib/api/action-errors";
import { apiFetch } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/session";

const MESSAGES = { NOT_FOUND: "That notification no longer exists." };

/** DOMAIN_RULES.md §18.6 — idempotent; only the caller's own. */
export async function markNotificationReadAction(id: unknown): Promise<ActionResult<null>> {
  await requireUser();
  const parsed = notificationIdSchema.safeParse(id);
  if (!parsed.success) return fail("That notification no longer exists.");
  try {
    await apiFetch(`/notifications/${parsed.data}/read`, {
      method: "POST",
      schema: z.undefined(),
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.notifications());
  return ok(null);
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<number>> {
  await requireUser();
  let updated: number;
  try {
    ({ updated } = await apiFetch("/notifications/me/read-all", {
      method: "POST",
      schema: markAllReadSchema,
    }));
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.notifications());
  return ok(updated);
}

/** §18.7 — the whole set, every time. */
export async function updateEmailPreferencesAction(
  input: unknown,
): Promise<ActionResult<EmailPreferences>> {
  await requireUser();
  const parsed = emailPreferencesSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);
  let preferences: EmailPreferences;
  try {
    preferences = await apiFetch("/notifications/preferences", {
      method: "PUT",
      body: parsed.data,
      schema: emailPreferencesSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.profile());
  return ok(preferences);
}
