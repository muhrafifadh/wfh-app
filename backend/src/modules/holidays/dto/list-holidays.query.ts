import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginationQuerySchema } from "@/common/dto/pagination.js";

/** Oldest date first. `from` and `to` are inclusive. */
export const listHolidaysQuerySchema = paginationQuerySchema
  .extend({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    path: ["to"],
    message: "Must be on or after from",
  });

export type ListHolidaysQueryInput = z.infer<typeof listHolidaysQuerySchema>;

export class ListHolidaysQuery extends createZodDto(listHolidaysQuerySchema) {}
