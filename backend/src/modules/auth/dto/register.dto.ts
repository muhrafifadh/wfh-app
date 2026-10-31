import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { emailSchema, newPasswordSchema } from "@/modules/auth/dto/password.js";

export const registerSchema = z.strictObject({
  name: z.string().trim().min(1, "Enter your name").max(100),
  email: emailSchema,
  password: newPasswordSchema,
  organizationName: z.string().trim().min(1, "Enter an organization name").max(100),
});

export class RegisterDto extends createZodDto(registerSchema) {}
