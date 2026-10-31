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

/** What the record shows for a time pair (recalculated by the server, never by clients). */
export const outcomeSchema = z.object({
  status: z.enum(["present", "late", "absent"]),
  lateMinutes: z.int(),
  workedMinutes: z.int().nullable(),
});

/** Before and after, from the record's own schedule snapshot. */
const outcomesSchema = z.object({ current: outcomeSchema, requested: outcomeSchema });

export const correctionResponseSchema = z.object({
  id: z.uuid(),
  attendanceId: z.uuid(),
  workDate: z.iso.date(),
  /** The record's time zone (its schedule snapshot): show times in it. */
  timezone: z.string(),
  status: z.enum(CORRECTION_STATUSES),
  employee: z.object({ id: z.uuid(), employeeNumber: z.string(), fullName: z.string() }),
  requestedBy: personSchema,
  /** The record's times when the request was submitted. */
  current: timePairSchema,
  /** The times the record gets if approved. */
  requested: timePairSchema,
  changes: z.array(z.enum(CORRECTION_CHANGES)),
  outcome: outcomesSchema,
  reason: z.string(),
  submittedAt: z.iso.datetime(),
  decision: z
    .object({ decidedBy: personSchema, decidedAt: z.iso.datetime(), note: z.string().nullable() })
    .nullable(),
  /** Whether the caller may approve or reject it now (pending, in scope, not their own). */
  canDecide: z.boolean(),
});

export type CorrectionResponseBody = z.infer<typeof correctionResponseSchema>;

/** POST /correction-requests/preview: what a proposal would do, before submitting it. */
export const correctionPreviewSchema = z.object({
  attendanceId: z.uuid(),
  workDate: z.iso.date(),
  timezone: z.string(),
  /** The last instant a request for this record is accepted. */
  submissionClosesAt: z.iso.datetime(),
  current: timePairSchema,
  requested: timePairSchema,
  changes: z.array(z.enum(CORRECTION_CHANGES)),
  outcome: outcomesSchema,
});

export type CorrectionPreviewBody = z.infer<typeof correctionPreviewSchema>;

export class CorrectionPreviewResponse extends createZodDto(correctionPreviewSchema) {}
export class CorrectionResponse extends createZodDto(correctionResponseSchema) {}
export class CorrectionListResponse extends createZodDto(paginated(correctionResponseSchema)) {}
