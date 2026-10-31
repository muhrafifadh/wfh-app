import { createZodDto } from "nestjs-zod";
import type { z } from "zod";

import { paginationQuerySchema } from "@/common/dto/pagination.js";

/** Newest version first. */
export const listWorkSchedulesQuerySchema = paginationQuerySchema;

export type ListWorkSchedulesQueryInput = z.infer<typeof listWorkSchedulesQuerySchema>;

export class ListWorkSchedulesQuery extends createZodDto(listWorkSchedulesQuerySchema) {}
