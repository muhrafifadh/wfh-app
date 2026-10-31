import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { PERMISSIONS } from "@/common/types/auth.js";

export const meResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  organizationId: z.uuid(),
  /** False until the user clicks the link in the verification email. */
  emailVerified: z.boolean(),
  /** Display only: access is decided by `permissions`. */
  role: z.object({ id: z.uuid(), name: z.string() }),
  permissions: z.array(z.enum(PERMISSIONS)),
});

export class MeResponse extends createZodDto(meResponseSchema) {}
