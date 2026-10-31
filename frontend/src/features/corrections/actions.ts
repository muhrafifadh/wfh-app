"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { routes } from "@/config/routes";
import { getCorrection } from "@/features/corrections/queries";
import {
  approveSchema,
  correctionFormSchema,
  correctionIdSchema,
  correctionPreviewSchema,
  correctionSchema,
  proposalSchema,
  rejectSchema,
  type Correction,
  type CorrectionPreview,
  type Proposal,
} from "@/features/corrections/schemas";
import { fail, ok, type ActionResult, type FieldErrors } from "@/lib/actions";
import { expectedFailure, FIX_FIELDS } from "@/lib/api/action-errors";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { can, requireUser } from "@/lib/auth/session";
import { formatDateTimeIn, zonedIso } from "@/lib/time-zone";

const GONE = "That request no longer exists, or you can't see it.";

/** UX_FLOWS.md §17 — backend corrections.errors.ts codes, in approved copy. */
const SUBMIT_MESSAGES = {
  CORRECTION_WINDOW_CLOSED: "Corrections can only be requested within 7 days. Contact Admin/HR.",
  CORRECTION_ALREADY_PENDING: "A correction for this day is already pending.",
  CORRECTION_TIMES_INVALID: FIX_FIELDS,
  EMPLOYEE_PROFILE_REQUIRED: "Your account doesn't have an employee profile. Contact Admin/HR.",
  NOT_FOUND: "That attendance record no longer exists.",
};

const DECIDE_MESSAGES = {
  CORRECTION_SELF_APPROVAL_FORBIDDEN: "You can't decide your own request.",
  CORRECTION_VERSION_CONFLICT:
    "This attendance record changed after the request was made. The employee needs to submit a new request.",
  NOT_FOUND: GONE,
};

/** Backend field names → the form's. */
const FIELD_NAMES: Record<string, string> = {
  requestedCheckInAt: "checkIn",
  requestedCheckOutAt: "checkOut",
};

/** A submit or preview failure, with the backend's field errors on the form's fields. */
function submitFailure(error: unknown): ActionResult<never> {
  const result = expectedFailure(error, SUBMIT_MESSAGES);
  if (result.ok) return result;
  const fieldErrors: FieldErrors | undefined =
    result.fieldErrors &&
    Object.fromEntries(
      Object.entries(result.fieldErrors).map(([field, messages]) => [
        FIELD_NAMES[field] ?? field,
        messages,
      ]),
    );
  return fail(result.error, fieldErrors);
}

/** Times on the work date in the record's zone → the instants the backend takes. */
function toInstants(proposal: Proposal) {
  const at = (time: string) => zonedIso(proposal.workDate, time, proposal.timezone);
  return {
    attendanceId: proposal.attendanceId,
    ...(proposal.checkIn && { requestedCheckInAt: at(proposal.checkIn) }),
    ...(proposal.checkOut && { requestedCheckOutAt: at(proposal.checkOut) }),
  };
}

async function mayRequest(): Promise<ActionResult<never> | null> {
  const user = await requireUser();
  return can(user, "correction:submit")
    ? null
    : fail("You don't have permission to request corrections.");
}

/** What the proposed times would do (status, lateness, duration), calculated by the server. */
export async function previewCorrectionAction(
  input: unknown,
): Promise<ActionResult<CorrectionPreview>> {
  const denied = await mayRequest();
  if (denied) return denied;
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  try {
    return ok(
      await apiFetch("/correction-requests/preview", {
        method: "POST",
        body: toInstants(parsed.data),
        schema: correctionPreviewSchema,
      }),
    );
  } catch (error) {
    return submitFailure(error);
  }
}

/** Submits the request. The record doesn't change until someone approves it. */
export async function submitCorrectionAction(input: unknown): Promise<ActionResult<Correction>> {
  const denied = await mayRequest();
  if (denied) return denied;
  const parsed = correctionFormSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);

  let created: Correction;
  try {
    created = await apiFetch("/correction-requests", {
      method: "POST",
      body: { ...toInstants(parsed.data), reason: parsed.data.reason },
      schema: correctionSchema,
    });
  } catch (error) {
    return submitFailure(error);
  }
  revalidatePath(routes.corrections());
  revalidatePath(routes.attendanceRecord(created.attendanceId));
  revalidatePath(routes.dashboard());
  return ok(created);
}

/**
 * The first decision is final (UX_FLOWS.md §9.4): when someone else got there first,
 * say who and when, and don't apply this one.
 */
async function alreadyDecided(id: string): Promise<ActionResult<never>> {
  const latest = await getCorrection(id);
  if (!latest?.decision)
    return fail("This request was already decided. Refresh to see the decision.");
  const { decidedBy, decidedAt } = latest.decision;
  return fail(
    `This request was already ${latest.status} by ${decidedBy.name} on ${formatDateTimeIn(decidedAt, latest.timezone)}.`,
  );
}

async function decide(
  id: unknown,
  path: "approve" | "reject",
  body: { decisionNote?: string },
): Promise<ActionResult<Correction>> {
  await requireUser();
  const correctionId = correctionIdSchema.safeParse(id);
  if (!correctionId.success) return fail(GONE);

  let decided: Correction;
  try {
    decided = await apiFetch(`/correction-requests/${correctionId.data}/${path}`, {
      method: "POST",
      body,
      schema: correctionSchema,
    });
  } catch (error) {
    if (error instanceof ApiError && error.code === "CORRECTION_ALREADY_DECIDED") {
      revalidatePath(routes.correction(correctionId.data));
      return alreadyDecided(correctionId.data);
    }
    return expectedFailure(error, DECIDE_MESSAGES);
  }
  revalidatePath(routes.correction(decided.id));
  revalidatePath(routes.correctionReview());
  revalidatePath(routes.dashboard());
  return ok(decided);
}

/** Applies the requested times; the record is recalculated by the server. */
export async function approveCorrectionAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<Correction>> {
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);
  return decide(id, "approve", parsed.data);
}

/** Leaves the record unchanged; a note is required. */
export async function rejectCorrectionAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<Correction>> {
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);
  return decide(id, "reject", parsed.data);
}
