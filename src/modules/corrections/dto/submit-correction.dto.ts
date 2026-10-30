import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/** Reasons and notes are 10–1,000 characters after trimming (DOMAIN_RULES.md §11.4). */
export const noteSchema = z
  .string()
  .trim()
  .min(10, "Use at least 10 characters")
  .max(1000, "Use at most 1,000 characters");

/** Propose a check-in, a check-out, or both; anything left out keeps its current value. */
export const submitCorrectionSchema = z
  .strictObject({
    attendanceId: z.uuid(),
    requestedCheckInAt: z.iso.datetime({ offset: true }).optional(),
    requestedCheckOutAt: z.iso.datetime({ offset: true }).optional(),
    reason: noteSchema,
  })
  .refine((v) => v.requestedCheckInAt !== undefined || v.requestedCheckOutAt !== undefined, {
    path: ["requestedCheckInAt"],
    message: "Propose a check-in, a check-out, or both",
  });

export type SubmitCorrectionInput = z.infer<typeof submitCorrectionSchema>;

export class SubmitCorrectionDto extends createZodDto(submitCorrectionSchema) {}

/** The same proposal without a reason, to see its effect first. */
export const previewCorrectionSchema = z
  .strictObject({
    attendanceId: z.uuid(),
    requestedCheckInAt: z.iso.datetime({ offset: true }).optional(),
    requestedCheckOutAt: z.iso.datetime({ offset: true }).optional(),
  })
  .refine((v) => v.requestedCheckInAt !== undefined || v.requestedCheckOutAt !== undefined, {
    path: ["requestedCheckInAt"],
    message: "Propose a check-in, a check-out, or both",
  });

export type PreviewCorrectionInput = z.infer<typeof previewCorrectionSchema>;

export class PreviewCorrectionDto extends createZodDto(previewCorrectionSchema) {}
