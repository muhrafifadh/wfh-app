import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { ALLOWED_CONTENT_TYPES, MAX_UPLOAD_BYTES } from "@/modules/uploads/uploads.constants.js";

export const createUploadSchema = z.strictObject({
  /** Shown to users and used as the download name. Never part of the storage key. */
  filename: z
    .string()
    .trim()
    .min(1, "Enter a file name")
    .max(255, "Use at most 255 characters")
    // oxlint-disable-next-line no-control-regex -- rejecting control characters is the point
    .regex(/^[^/\\\u0000-\u001f]+$/, "File names can't contain slashes or control characters"),
  contentType: z.enum(ALLOWED_CONTENT_TYPES, "This file type isn't allowed"),
  size: z
    .int()
    .min(1, "The file is empty")
    .max(MAX_UPLOAD_BYTES, `Files can be at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`),
});

export type CreateUploadInput = z.infer<typeof createUploadSchema>;

export class CreateUploadDto extends createZodDto(createUploadSchema) {}
