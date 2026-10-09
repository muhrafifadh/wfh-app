import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { PERMISSIONS } from "@/common/types/auth.js";

export const roleResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  permissions: z.array(z.enum(PERMISSIONS)),
});

export type RoleResponseBody = z.infer<typeof roleResponseSchema>;

/** Roles are few per organization, so the list isn't paginated: { items }. */
export class RoleListResponse extends createZodDto(
  z.object({ items: z.array(roleResponseSchema) }),
) {}
