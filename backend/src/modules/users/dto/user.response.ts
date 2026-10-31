import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginated } from "@/common/dto/pagination.js";
import { USER_STATUSES } from "@/modules/users/users.constants.js";

export const roleSummarySchema = z.object({ id: z.uuid(), name: z.string() });

export const userResponseSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: roleSummarySchema,
  status: z.enum(USER_STATUSES),
  emailVerified: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type UserResponseBody = z.infer<typeof userResponseSchema>;

export class UserResponse extends createZodDto(userResponseSchema) {}
export class UserListResponse extends createZodDto(paginated(userResponseSchema)) {}
