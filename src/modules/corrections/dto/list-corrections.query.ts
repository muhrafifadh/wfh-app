import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginationQuerySchema } from "@/common/dto/pagination.js";
import { CORRECTION_STATUSES } from "@/modules/corrections/corrections.constants.js";

/** Own requests, newest submission first. */
export const listMyCorrectionsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(CORRECTION_STATUSES).optional(),
  /** One record's requests (its correction history). */
  attendanceId: z.uuid().optional(),
});

export type ListMyCorrectionsQueryInput = z.infer<typeof listMyCorrectionsQuerySchema>;

export class ListMyCorrectionsQuery extends createZodDto(listMyCorrectionsQuerySchema) {}

/** The review queue: pending by default, oldest first so nothing waits forever. */
export const listCorrectionsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(CORRECTION_STATUSES).default("pending"),
  employeeId: z.uuid().optional(),
});

export type ListCorrectionsQueryInput = z.infer<typeof listCorrectionsQuerySchema>;

export class ListCorrectionsQuery extends createZodDto(listCorrectionsQuerySchema) {}
