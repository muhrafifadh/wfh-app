import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginationQuerySchema } from "@/common/dto/pagination.js";

/** The caller's delivered notifications, newest first (DOMAIN_RULES.md §18.6). */
export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  /** Only unread ones. */
  unread: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

export type ListNotificationsQueryInput = z.infer<typeof listNotificationsQuerySchema>;

export class ListNotificationsQuery extends createZodDto(listNotificationsQuerySchema) {}
