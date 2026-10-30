import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginated } from "@/common/dto/pagination.js";
import {
  CORRECTION_CHANGES,
  CORRECTION_STATUSES,
} from "@/modules/corrections/corrections.constants.js";

const timePairSchema = z.object({
  checkInAt: z.iso.datetime().nullable(),
  checkOutAt: z.iso.datetime().nullable(),
});

const personSchema = z.object({ id: z.uuid(), name: z.string() });

export const correctionResponseSchema = z.object({
  id: z.uuid(),
  attendanceId: z.uuid(),
  workDate: z.iso.date(),
  status: z.enum(CORRECTION_STATUSES),
  employee: z.object({ id: z.uuid(), employeeNumber: z.string(), fullName: z.string() }),
  requestedBy: personSchema,
  /** The record's times when the request was submitted. */
  current: timePairSchema,
  /** The times the record gets if approved. */
  requested: timePairSchema,
  changes: z.array(z.enum(CORRECTION_CHANGES)),
  reason: z.string(),
  submittedAt: z.iso.datetime(),
  decision: z
    .object({ decidedBy: personSchema, decidedAt: z.iso.datetime(), note: z.string().nullable() })
    .nullable(),
  /** Whether the caller may approve or reject it now (pending, in scope, not their own). */
  canDecide: z.boolean(),
});

export type CorrectionResponseBody = z.infer<typeof correctionResponseSchema>;

export class CorrectionResponse extends createZodDto(correctionResponseSchema) {}
export class CorrectionListResponse extends createZodDto(paginated(correctionResponseSchema)) {}
