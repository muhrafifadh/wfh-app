import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { noteSchema } from "@/modules/corrections/dto/submit-correction.dto.js";

/** A note is optional when approving (§11.4). */
export const approveCorrectionSchema = z.preprocess(
  (body) => body ?? {},
  z.strictObject({ decisionNote: noteSchema.optional() }),
);

export type ApproveCorrectionInput = z.infer<typeof approveCorrectionSchema>;

export class ApproveCorrectionDto extends createZodDto(approveCorrectionSchema) {}

/** Rejections always explain why. */
export const rejectCorrectionSchema = z.strictObject({ decisionNote: noteSchema });

export type RejectCorrectionInput = z.infer<typeof rejectCorrectionSchema>;

export class RejectCorrectionDto extends createZodDto(rejectCorrectionSchema) {}
