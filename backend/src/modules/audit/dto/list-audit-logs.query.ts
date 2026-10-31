import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginationQuerySchema } from "@/common/dto/pagination.js";

export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  /** e.g. "user.deactivated" */
  action: z
    .string()
    .trim()
    .regex(/^[a-z_]+\.[a-z_]+$/, "Use an action name like user.invited")
    .optional(),
  actorId: z.uuid().optional(),
  targetId: z.uuid().optional(),
});

export type ListAuditLogsQueryInput = z.infer<typeof listAuditLogsQuerySchema>;

export class ListAuditLogsQuery extends createZodDto(listAuditLogsQuerySchema) {}
