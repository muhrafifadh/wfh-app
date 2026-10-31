import { z } from "zod";

import { USER_STATUSES } from "@/features/users/constants";
import { PERMISSIONS } from "@/types/auth";

// Backend response shapes (backend src/modules/users/dto), checked in contract.ts

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.object({ id: z.string(), name: z.string() }),
  status: z.enum(USER_STATUSES),
  emailVerified: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type User = z.infer<typeof userSchema>;

export const userListSchema = z.object({
  items: z.array(userSchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
});

export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  permissions: z.array(z.enum(PERMISSIONS)),
});
export type Role = z.infer<typeof roleSchema>;

export const roleListSchema = z.object({ items: z.array(roleSchema) });

// What we send

const nameSchema = z.string().trim().min(1, "Enter a name").max(100, "Use at most 100 characters");

export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email")),
  name: nameSchema,
  roleId: z.string().min(1, "Choose a role").pipe(z.uuid("Choose a role")),
});
export type InviteUserInput = z.infer<typeof inviteUserSchema>;

export const updateUserSchema = z.object({
  name: nameSchema,
  roleId: inviteUserSchema.shape.roleId,
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** For actions that take only a user id (deactivate, reactivate, resend). */
export const userIdSchema = z.uuid();
