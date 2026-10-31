import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginationQuerySchema, sortValues } from "@/common/dto/pagination.js";
import { USER_SORT_FIELDS, USER_STATUSES } from "@/modules/users/users.constants.js";

export const listUsersQuerySchema = paginationQuerySchema.extend({
  /** Matches name or email. */
  q: z.string().trim().max(100).optional(),
  status: z.enum(USER_STATUSES).optional(),
  roleId: z.uuid().optional(),
  sort: z.enum(sortValues(USER_SORT_FIELDS)).default("name"),
});

export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>;

export class ListUsersQuery extends createZodDto(listUsersQuerySchema) {}
