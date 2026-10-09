import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { emailSchema } from "@/modules/auth/dto/password.js";

export const loginSchema = z.strictObject({
  email: emailSchema,
  // No strength rules at login: they belong to registration and password change.
  password: z.string().min(1, "Enter your password").max(256),
});

export class LoginDto extends createZodDto(loginSchema) {}
