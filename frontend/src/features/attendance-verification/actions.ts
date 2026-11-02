"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { routes } from "@/config/routes";
import {
  discloseFormSchema,
  idSchema,
  justificationIsLongEnough,
  myVerificationSchema,
  officeFormSchema,
  officeSchema,
  photoRequestSchema,
  photoUploadInputSchema,
  photoUploadSchema,
  settingsFormSchema,
  signedPhotoSchema,
  verificationItemSchema,
  verificationSettingsSchema,
  workLocationFormSchema,
  workLocationRequestSchema,
  type MyVerification,
  type SignedPhoto,
  type VerificationSettings,
} from "@/features/attendance-verification/schemas";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { expectedFailure, FIX_FIELDS } from "@/lib/api/action-errors";
import { apiFetch } from "@/lib/api/client";
import { can, requireUser } from "@/lib/auth/session";
import type { Permission } from "@/types/auth";

/** Backend attendance-verification.errors.ts codes, in plain words. */
const MESSAGES = {
  VERIFICATION_NOT_AVAILABLE:
    "Attendance checks aren't available on this deployment yet, so they can't be turned on.",
  VERIFICATION_JUSTIFICATION_REQUIRED: "Record why this check is needed before turning it on.",
  VERIFICATION_DISABLED: "This check isn't turned on for your organization.",
  VERIFICATION_NOTICE_REQUIRED: "Read the attendance checks notice first.",
  WORK_LOCATION_ALREADY_DECIDED: "This location request has already been decided.",
  PHOTO_REQUEST_ALREADY_DECIDED: "This photo request has already been decided.",
  PHOTO_NOT_AVAILABLE: "This photo has already been deleted (photos are kept for 30 days).",
  NOT_FOUND: "That item no longer exists.",
};

async function authorize(permission: Permission): Promise<ActionResult<never> | null> {
  const user = await requireUser();
  return can(user, permission) ? null : fail("You don't have permission to do that.");
}

const refreshEmployeeViews = () => {
  revalidatePath(routes.dashboard());
  revalidatePath(routes.attendance());
  revalidatePath(routes.myVerification());
};

// The employee (attendance:self)

export async function acknowledgeNoticeAction(): Promise<ActionResult> {
  const denied = await authorize("attendance:self");
  if (denied) return denied;
  try {
    await apiFetch("/attendance-verification/notice/acknowledge", {
      method: "POST",
      schema: z.undefined(),
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  refreshEmployeeViews();
  return ok(undefined);
}

export async function requestWorkLocationAction(
  input: unknown,
): Promise<ActionResult<MyVerification>> {
  const denied = await authorize("attendance:self");
  if (denied) return denied;
  const parsed = workLocationFormSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);
  try {
    const result = await apiFetch("/attendance-verification/work-locations", {
      method: "POST",
      body: parsed.data,
      schema: myVerificationSchema,
    });
    refreshEmployeeViews();
    return ok(result);
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
}

/** A signed URL the browser PUTs the photo to, straight to storage, before recording. */
export async function startPhotoUploadAction(
  input: unknown,
): Promise<ActionResult<{ uploadUrl: string; uploadHeaders: Record<string, string> }>> {
  const denied = await authorize("attendance:self");
  if (denied) return denied;
  const parsed = photoUploadInputSchema.safeParse(input);
  if (!parsed.success) return fail("The photo is too large. Take it again.");
  try {
    const started = await apiFetch("/attendance-verification/photo-upload", {
      method: "POST",
      body: parsed.data,
      schema: photoUploadSchema,
    });
    return ok({ uploadUrl: started.uploadUrl, uploadHeaders: started.uploadHeaders });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
}

/** Decision V12: the employee asks; Admin/HR checks their identity and discloses. */
export async function requestPhotoAction(verificationId: unknown): Promise<ActionResult> {
  const denied = await authorize("attendance:self");
  if (denied) return denied;
  const id = idSchema.safeParse(verificationId);
  if (!id.success) return fail(MESSAGES.NOT_FOUND);
  try {
    await apiFetch("/attendance-verification/photo-requests", {
      method: "POST",
      body: { verificationId: id.data },
      schema: photoRequestSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.myVerification());
  return ok(undefined);
}

// Admin/HR (verification:manage, verification:read_photo)

export async function updateVerificationSettingsAction(
  before: VerificationSettings,
  input: unknown,
): Promise<ActionResult<VerificationSettings>> {
  const denied = await authorize("verification:manage");
  if (denied) return denied;
  const parsed = settingsFormSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);
  const turningOn =
    (parsed.data.locationEnabled && !before.locationEnabled) ||
    (parsed.data.selfieEnabled && !before.selfieEnabled);
  if (turningOn && !justificationIsLongEnough(parsed.data.justification)) {
    return fail(MESSAGES.VERIFICATION_JUSTIFICATION_REQUIRED, {
      justification: ["Record why this check is needed (at least 20 characters)"],
    });
  }
  let settings: VerificationSettings;
  try {
    settings = await apiFetch("/attendance-verification/settings", {
      method: "PATCH",
      body: {
        locationEnabled: parsed.data.locationEnabled,
        selfieEnabled: parsed.data.selfieEnabled,
        ...(turningOn && { justification: parsed.data.justification }),
      },
      schema: verificationSettingsSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.verificationSettings());
  return ok(settings);
}

export async function decideWorkLocationAction(
  id: unknown,
  decision: "approve" | "reject",
): Promise<ActionResult> {
  const denied = await authorize("verification:manage");
  if (denied) return denied;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success || (decision !== "approve" && decision !== "reject")) {
    return fail(MESSAGES.NOT_FOUND);
  }
  try {
    await apiFetch(`/attendance-verification/work-locations/${parsed.data}/${decision}`, {
      method: "POST",
      ...(decision === "approve" && { body: {} }),
      schema: workLocationRequestSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.verificationSettings());
  return ok(undefined);
}

export async function addOfficeAction(input: unknown): Promise<ActionResult> {
  const denied = await authorize("verification:manage");
  if (denied) return denied;
  const parsed = officeFormSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);
  try {
    await apiFetch("/attendance-verification/offices", {
      method: "POST",
      body: parsed.data,
      schema: officeSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.verificationSettings());
  return ok(undefined);
}

export async function removeOfficeAction(id: unknown): Promise<ActionResult> {
  const denied = await authorize("verification:manage");
  if (denied) return denied;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return fail(MESSAGES.NOT_FOUND);
  try {
    await apiFetch(`/attendance-verification/offices/${parsed.data}`, {
      method: "DELETE",
      schema: z.undefined(),
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.verificationSettings());
  return ok(undefined);
}

export async function reviewVerificationAction(id: unknown): Promise<ActionResult> {
  const denied = await authorize("verification:manage");
  if (denied) return denied;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return fail(MESSAGES.NOT_FOUND);
  try {
    await apiFetch(`/attendance-verification/${parsed.data}/review`, {
      method: "POST",
      schema: verificationItemSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.verificationReview());
  return ok(undefined);
}

/** A short-lived link. The backend audits every call (decision V9). */
export async function viewPhotoAction(id: unknown): Promise<ActionResult<SignedPhoto>> {
  const denied = await authorize("verification:read_photo");
  if (denied) return denied;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return fail(MESSAGES.NOT_FOUND);
  try {
    return ok(
      await apiFetch(`/attendance-verification/${parsed.data}/photo`, {
        schema: signedPhotoSchema,
      }),
    );
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
}

export async function disclosePhotoAction(
  id: unknown,
  input: unknown,
): Promise<ActionResult<SignedPhoto>> {
  const denied = await authorize("verification:read_photo");
  if (denied) return denied;
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return fail(MESSAGES.NOT_FOUND);
  const parsed = discloseFormSchema.safeParse(input);
  if (!parsed.success) return fail(FIX_FIELDS, z.flattenError(parsed.error).fieldErrors);
  let photo: SignedPhoto;
  try {
    photo = await apiFetch(`/attendance-verification/photo-requests/${parsedId.data}/disclose`, {
      method: "POST",
      body: parsed.data,
      schema: signedPhotoSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.verificationSettings());
  return ok(photo);
}

export async function declinePhotoRequestAction(id: unknown): Promise<ActionResult> {
  const denied = await authorize("verification:read_photo");
  if (denied) return denied;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return fail(MESSAGES.NOT_FOUND);
  try {
    await apiFetch(`/attendance-verification/photo-requests/${parsed.data}/decline`, {
      method: "POST",
      schema: photoRequestSchema,
    });
  } catch (error) {
    return expectedFailure(error, MESSAGES);
  }
  revalidatePath(routes.verificationSettings());
  return ok(undefined);
}
