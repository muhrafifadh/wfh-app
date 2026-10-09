import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginated } from "@/common/dto/pagination.js";
import { ALLOWED_CONTENT_TYPES } from "@/modules/uploads/uploads.constants.js";

export const uploadResponseSchema = z.object({
  id: z.uuid(),
  filename: z.string(),
  contentType: z.enum(ALLOWED_CONTENT_TYPES),
  size: z.int(),
  status: z.enum(["pending", "ready"]),
  uploadedBy: z.object({ id: z.uuid(), name: z.string() }),
  /** Short-lived link; null until the upload is complete. Ask again when it expires. */
  downloadUrl: z.url().nullable(),
  createdAt: z.iso.datetime(),
});

export type UploadResponseBody = z.infer<typeof uploadResponseSchema>;

export class UploadResponse extends createZodDto(uploadResponseSchema) {}
export class UploadListResponse extends createZodDto(paginated(uploadResponseSchema)) {}

export const createUploadResponseSchema = z.object({
  upload: uploadResponseSchema,
  /** PUT the file here, with exactly these headers, then call POST /uploads/:id/complete. */
  uploadUrl: z.url(),
  uploadHeaders: z.record(z.string(), z.string()),
  expiresAt: z.iso.datetime(),
});

export type CreateUploadResponseBody = z.infer<typeof createUploadResponseSchema>;

export class CreateUploadResponse extends createZodDto(createUploadResponseSchema) {}
