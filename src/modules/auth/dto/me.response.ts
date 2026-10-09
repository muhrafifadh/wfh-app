import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { PERMISSIONS } from "@/common/types/auth.js";

export const meResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  organizationId: z.uuid(),
  permissions: z.array(z.enum(PERMISSIONS)),
});

export class MeResponse extends createZodDto(meResponseSchema) {}
