import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { emailSchema } from "@/modules/auth/dto/password.js";

export const inviteUserSchema = z.strictObject({
  email: emailSchema,
  name: z.string().trim().min(1, "Enter a name").max(100, "Use at most 100 characters"),
  roleId: z.uuid("Choose a role"),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export class InviteUserDto extends createZodDto(inviteUserSchema) {}
