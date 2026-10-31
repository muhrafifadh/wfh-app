import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { inviteUserSchema } from "@/modules/users/dto/invite-user.dto.js";

// Email isn't editable here: changing it needs re-verification.
export const updateUserSchema = inviteUserSchema
  .pick({ name: true, roleId: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Change at least one field" });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export class UpdateUserDto extends createZodDto(updateUserSchema) {}
