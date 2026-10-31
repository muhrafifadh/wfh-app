import { z } from "zod";

import { FILE_TYPES, MAX_UPLOAD_BYTES } from "@/features/files/constants";

// Backend shapes (backend src/modules/uploads/dto), checked in contract.ts

export const uploadSchema = z.object({
  id: z.string(),
  filename: z.string(),
  contentType: z.enum(FILE_TYPES),
  size: z.number(),
  status: z.enum(["pending", "ready"]),
  uploadedBy: z.object({ id: z.string(), name: z.string() }),
  downloadUrl: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type Upload = z.infer<typeof uploadSchema>;

export const uploadListSchema = z.object({
  items: z.array(uploadSchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
});

export const createUploadResponseSchema = z.object({
  upload: uploadSchema,
  uploadUrl: z.string(),
  uploadHeaders: z.record(z.string(), z.string()),
  expiresAt: z.iso.datetime(),
});

export const createUploadSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1)
    .max(255, "File names can be at most 255 characters")
    .regex(/^[^/\\]+$/, "File names can't contain slashes"),
  contentType: z.enum(FILE_TYPES, "This file type isn't allowed"),
  size: z
    .int()
    .min(1, "The file is empty")
    .max(MAX_UPLOAD_BYTES, `Files can be at most ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`),
});
export type CreateUploadInput = z.infer<typeof createUploadSchema>;

export const uploadIdSchema = z.uuid();
