import { z } from "zod";

// Backend response shape (backend src/modules/audit/dto), checked in contract.ts
export const auditLogSchema = z.object({
  id: z.string(),
  action: z.string(),
  actor: z.object({ id: z.string(), name: z.string(), email: z.string() }).nullable(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  requestId: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;

export const auditLogListSchema = z.object({
  items: z.array(auditLogSchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
});
