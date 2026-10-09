import { createZodDto } from "nestjs-zod";
import { z } from "zod";

export const loginSchema = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email")),
  // No strength rules at login: they belong to registration and password change.
  password: z.string().min(1, "Enter your password").max(256),
});

export class LoginDto extends createZodDto(loginSchema) {}
