"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { routes } from "@/config/routes";
import {
  createUploadResponseSchema,
  createUploadSchema,
  uploadIdSchema,
  uploadSchema,
  type Upload,
} from "@/features/files/schemas";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";

// docs/17-file-uploads.md (backend): the bytes go from the browser straight to
// storage. These actions only start and finish the upload.

function expectedFailure(error: unknown): ActionResult<never> {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "UPLOAD_NOT_RECEIVED":
        return fail("The file didn't reach storage. Try uploading it again.");
      case "UPLOAD_MISMATCH":
        return fail("The file's content doesn't match its type, so it was removed.");
      case "NOT_FOUND":
        return fail("That file no longer exists.");
    }
    if (error.status === 400) {
      const first = Object.values(error.fieldErrors ?? {}).flat()[0];
      return fail(first ?? "This file can't be uploaded.");
    }
  }
  throw error;
}

/** Step 1: register the file and get a signed URL to PUT it to. */
export async function startUploadAction(
  input: unknown,
): Promise<ActionResult<{ id: string; uploadUrl: string; uploadHeaders: Record<string, string> }>> {
  await requireUser();
  const parsed = createUploadSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      Object.values(z.flattenError(parsed.error).fieldErrors).flat()[0] ?? "Invalid file",
    );
  }

  try {
    const created = await apiFetch("/uploads", {
      method: "POST",
      body: parsed.data,
      schema: createUploadResponseSchema,
    });
    return ok({
      id: created.upload.id,
      uploadUrl: created.uploadUrl,
      uploadHeaders: created.uploadHeaders,
    });
  } catch (error) {
    return expectedFailure(error);
  }
}

/** Step 3: after the PUT, the backend checks what arrived. */
export async function completeUploadAction(id: unknown): Promise<ActionResult<Upload>> {
  await requireUser();
  const uploadId = uploadIdSchema.safeParse(id);
  if (!uploadId.success) return fail("That file no longer exists.");

  let upload: Upload;
  try {
    upload = await apiFetch(`/uploads/${uploadId.data}/complete`, {
      method: "POST",
      schema: uploadSchema,
    });
  } catch (error) {
    return expectedFailure(error);
  }
  revalidatePath(routes.files());
  return ok(upload);
}

/** Only the uploader can delete; the backend answers 404 for anyone else. */
export async function deleteFileAction(id: unknown): Promise<ActionResult> {
  await requireUser();
  const uploadId = uploadIdSchema.safeParse(id);
  if (!uploadId.success) return fail("That file no longer exists.");

  try {
    await apiFetch(`/uploads/${uploadId.data}`, { method: "DELETE", schema: z.undefined() });
  } catch (error) {
    return expectedFailure(error);
  }
  revalidatePath(routes.files());
  return ok(undefined);
}
