import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginated } from "@/common/dto/pagination.js";

export const auditLogResponseSchema = z.object({
  id: z.uuid(),
  action: z.string(),
  /** Null when no signed-in user did it, or the user was removed. */
  actor: z.object({ id: z.uuid(), name: z.string(), email: z.email() }).nullable(),
  targetType: z.string().nullable(),
  targetId: z.uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  requestId: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type AuditLogResponseBody = z.infer<typeof auditLogResponseSchema>;

export class AuditLogListResponse extends createZodDto(paginated(auditLogResponseSchema)) {}
