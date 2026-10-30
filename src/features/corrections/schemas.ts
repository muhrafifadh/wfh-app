import { z } from "zod";

import { CORRECTION_CHANGES, CORRECTION_STATUSES } from "@/features/corrections/constants";

// Backend response shapes (backend src/modules/corrections/dto), checked in contract.ts

const timePairSchema = z.object({
  checkInAt: z.iso.datetime().nullable(),
  checkOutAt: z.iso.datetime().nullable(),
});

const personSchema = z.object({ id: z.uuid(), name: z.string() });

export const correctionSchema = z.object({
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
  canDecide: z.boolean(),
});
export type Correction = z.infer<typeof correctionSchema>;

export const correctionListSchema = z.object({
  items: z.array(correctionSchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
});
