import { z } from "zod";

import { PERMISSIONS } from "@/types/auth";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email")),
  password: z.string().min(1, "Enter your password").max(256),
});
export type LoginInput = z.infer<typeof loginSchema>;

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
