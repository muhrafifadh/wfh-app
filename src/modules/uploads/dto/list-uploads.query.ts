import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginationQuerySchema } from "@/common/dto/pagination.js";

export const listUploadsQuerySchema = paginationQuerySchema.extend({
  /** Matches the file name. */
  q: z.string().trim().max(100).optional(),
});

export type ListUploadsQueryInput = z.infer<typeof listUploadsQuerySchema>;

export class ListUploadsQuery extends createZodDto(listUploadsQuerySchema) {}
