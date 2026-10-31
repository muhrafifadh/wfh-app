import { z } from "zod";

import { CORRECTION_CHANGES, CORRECTION_STATUSES } from "@/features/corrections/constants";

// Backend response shapes (backend src/modules/corrections/dto), checked in contract.ts

const timePairSchema = z.object({
  checkInAt: z.iso.datetime().nullable(),
  checkOutAt: z.iso.datetime().nullable(),
});

const personSchema = z.object({ id: z.uuid(), name: z.string() });

/** What the record shows for a time pair, recalculated by the server. */
export const outcomeSchema = z.object({
  status: z.enum(["present", "late", "absent"]),
  lateMinutes: z.int(),
  workedMinutes: z.int().nullable(),
});
export type Outcome = z.infer<typeof outcomeSchema>;

const outcomesSchema = z.object({ current: outcomeSchema, requested: outcomeSchema });

export const correctionSchema = z.object({
  id: z.uuid(),
  attendanceId: z.uuid(),
  workDate: z.iso.date(),
  /** The record's zone: show its times in it. */
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
  /** The caller may approve or reject it now (pending, in scope, not their own). */
  canDecide: z.boolean(),
});
export type Correction = z.infer<typeof correctionSchema>;

export const correctionListSchema = z.object({
  items: z.array(correctionSchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
});
export type CorrectionList = z.infer<typeof correctionListSchema>;

/** POST /correction-requests/preview */
export const correctionPreviewSchema = z.object({
  attendanceId: z.uuid(),
  workDate: z.iso.date(),
  timezone: z.string(),
  submissionClosesAt: z.iso.datetime(),
  current: timePairSchema,
  requested: timePairSchema,
  changes: z.array(z.enum(CORRECTION_CHANGES)),
  outcome: outcomesSchema,
});
export type CorrectionPreview = z.infer<typeof correctionPreviewSchema>;

// What we send

export const correctionIdSchema = z.uuid();

const time = z.union([
  z.literal(""),
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time"),
]);

/** A note: 10–1,000 characters after trimming (DOMAIN_RULES.md §11.4). */
export const noteSchema = z
  .string()
  .trim()
  .min(10, "Use at least 10 characters")
  .max(1000, "Use at most 1,000 characters");

/** The times part of the request form, in the record's zone on its work date. */
export const proposalSchema = z
  .object({
    attendanceId: z.uuid(),
    workDate: z.iso.date(),
    timezone: z.string().min(1),
    checkIn: time,
    checkOut: time,
  })
  .refine((value) => value.checkIn !== "" || value.checkOut !== "", {
    path: ["checkIn"],
    message: "Propose a check-in, a check-out, or both",
  })
  .refine((value) => !value.checkIn || !value.checkOut || value.checkIn <= value.checkOut, {
    path: ["checkOut"],
    message: "Check out at or after the check-in",
  });
export type ProposalInput = z.input<typeof proposalSchema>;
export type Proposal = z.output<typeof proposalSchema>;

/** The whole request form. */
export const correctionFormSchema = proposalSchema.and(z.object({ reason: noteSchema }));
export type CorrectionFormInput = z.input<typeof correctionFormSchema>;
export type CorrectionForm = z.output<typeof correctionFormSchema>;

/** POST /correction-requests */
export const submitCorrectionSchema = z.object({
  attendanceId: z.uuid(),
  requestedCheckInAt: z.string().optional(),
  requestedCheckOutAt: z.string().optional(),
  reason: z.string(),
});

/** POST /correction-requests/preview */
export const previewCorrectionSchema = submitCorrectionSchema.omit({ reason: true });

export const approveSchema = z.object({
  decisionNote: z.union([z.literal("").transform(() => undefined), noteSchema]).optional(),
});
export type ApproveInput = z.input<typeof approveSchema>;

export const rejectSchema = z.object({ decisionNote: noteSchema });
export type RejectInput = z.input<typeof rejectSchema>;
