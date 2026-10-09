import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { emailSchema, newPasswordSchema } from "@/modules/auth/dto/password.js";

export class PasswordResetRequestDto extends createZodDto(z.strictObject({ email: emailSchema })) {}

export class PasswordResetConfirmDto extends createZodDto(
  z.strictObject({
    token: z.string().min(20).max(200),
    password: newPasswordSchema,
  }),
) {}
