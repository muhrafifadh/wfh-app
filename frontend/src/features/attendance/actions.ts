"use server";

import { revalidatePath } from "next/cache";

import { routes } from "@/config/routes";
import { formatMinute } from "@/features/attendance/format";
import { getToday } from "@/features/attendance/queries";
import { attendanceSchema, idempotencyKeySchema, type Today } from "@/features/attendance/schemas";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { can, requireUser } from "@/lib/auth/session";
import { reportError } from "@/lib/logger";

/**
 * How a check-in/out ended. "unconfirmed" means we don't know whether the backend
 * recorded it (timeout, network, 5xx): the card re-checks today's state before it
 * offers anything new, and a retry reuses the same Idempotency-Key.
 */
export type AttendanceOutcome =
  | { kind: "recorded"; at: string; timezone: string; today: Today | null }
  | { kind: "rejected"; message: string; today: Today | null }
  | { kind: "unconfirmed"; message: string; requestId: string | null };

const UNCONFIRMED = "We couldn't confirm the result. Checking your status…";

/** UX_FLOWS.md §17 — backend attendance.errors.ts codes, in approved copy. */
function rejectionMessage(error: ApiError, timeZone: string | null): string | null {
  const at = (key: string) => {
    const value = error.details?.[key];
    return typeof value === "string" && timeZone ? formatMinute(value, timeZone) : null;
  };
  switch (error.code) {
    case "CHECK_IN_TOO_EARLY": {
      const opensAt = at("opensAt");
      return opensAt ? `Check-in opens at ${opensAt}.` : "Check-in isn't open yet.";
    }
    case "ATTENDANCE_NOT_WORKDAY":
      return "Today is not a working day.";
    case "ATTENDANCE_ALREADY_CHECKED_IN":
      return "Your check-in is already recorded.";
    case "ATTENDANCE_NOT_CHECKED_IN":
      return "You need to check in before checking out.";
    case "ATTENDANCE_ALREADY_CHECKED_OUT":
      return "Your check-out is already recorded.";
    case "CHECK_IN_WINDOW_CLOSED":
      return "Today's check-in window has closed.";
    case "CHECK_OUT_WINDOW_CLOSED":
      return "The check-out deadline has passed. Request a correction instead.";
    case "EMPLOYEE_INACTIVE":
      return "Your employee profile is inactive. Contact Admin/HR.";
    case "EMPLOYEE_PROFILE_REQUIRED":
      return "Your account doesn't have an active employee profile. Contact Admin/HR.";
    case "IDEMPOTENCY_KEY_REUSED":
      return "That attempt was already used. Check your status and try again.";
    default:
      return null;
  }
}

/** Today's state after an action, or null if even that can't be read right now. */
async function todayOrNull(): Promise<Today | null> {
  try {
    return await getToday();
  } catch (error) {
    reportError(error);
    return null;
  }
}

async function record(
  path: "/attendance/check-in" | "/attendance/check-out",
  key: unknown,
): Promise<ActionResult<AttendanceOutcome>> {
  const user = await requireUser();
  if (!can(user, "attendance:self")) return fail("You don't have permission to record attendance.");
  const parsedKey = idempotencyKeySchema.safeParse(key);
  if (!parsedKey.success) return fail("Something went wrong. Refresh the page and try again.");

  let recorded;
  try {
    // No body: time, employee and status all come from the server (PRD ATT-03)
    recorded = await apiFetch(path, {
      method: "POST",
      headers: { "Idempotency-Key": parsedKey.data },
      schema: attendanceSchema,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status < 500) {
      const today = await todayOrNull();
      const message = rejectionMessage(error, today?.schedule?.timezone ?? today?.timezone ?? null);
      if (message) return ok({ kind: "rejected", message, today });
      throw error;
    }
    reportError(error);
    return ok({
      kind: "unconfirmed",
      message: UNCONFIRMED,
      requestId: error instanceof ApiError ? (error.requestId ?? null) : null,
    });
  }

  revalidatePath(routes.dashboard());
  revalidatePath(routes.attendanceHistory());
  const at = path === "/attendance/check-in" ? recorded.checkInAt : recorded.checkOutAt;
  return ok({
    kind: "recorded",
    at: at ?? recorded.updatedAt,
    timezone: recorded.schedule.timezone,
    today: await todayOrNull(),
  });
}

/** Records a check-in at server time. Reuse `idempotencyKey` to retry the same intent. */
export async function checkInAction(idempotencyKey: unknown) {
  return record("/attendance/check-in", idempotencyKey);
}

/** Records today's check-out at server time. Reuse `idempotencyKey` to retry. */
export async function checkOutAction(idempotencyKey: unknown) {
  return record("/attendance/check-out", idempotencyKey);
}
