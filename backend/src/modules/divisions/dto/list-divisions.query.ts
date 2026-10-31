import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginationQuerySchema, sortValues } from "@/common/dto/pagination.js";
import {
  DIVISION_SORT_FIELDS,
  DIVISION_STATUSES,
} from "@/modules/divisions/divisions.constants.js";

export const listDivisionsQuerySchema = paginationQuerySchema.extend({
  /** Matches code or name. */
  q: z.string().trim().max(100).optional(),
  status: z.enum(DIVISION_STATUSES).optional(),
  sort: z.enum(sortValues(DIVISION_SORT_FIELDS)).default("name"),
});

export type ListDivisionsQueryInput = z.infer<typeof listDivisionsQuerySchema>;

export class ListDivisionsQuery extends createZodDto(listDivisionsQuerySchema) {}
