import { z } from "zod";

import { PERMISSIONS } from "@/types/auth";

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email"));

// Same rule as the backend's newPasswordSchema: length matters, character types don't.
const newPasswordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(256, "Use at most 256 characters");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(256),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100),
  organizationName: z.string().trim().min(1, "Enter an organization name").max(100),
  email: emailSchema,
  password: newPasswordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** The form has a confirm field; only `password` goes to the server. */
export const resetPasswordFormSchema = z
  .object({ password: newPasswordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: newPasswordSchema,
});

// Backend response shapes (backend docs/08-authentication.md)
export const tokenPairSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: z.iso.datetime(),
  refreshToken: z.string(),
  refreshTokenExpiresAt: z.iso.datetime(),
});

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  organizationId: z.string(),
  // Ignore permissions this frontend doesn't know yet instead of failing the whole session
  permissions: z
    .array(z.string())
    .transform((list) =>
      list.filter((p): p is (typeof PERMISSIONS)[number] =>
        (PERMISSIONS as readonly string[]).includes(p),
      ),
    ),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;
