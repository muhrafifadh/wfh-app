import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginated } from "@/common/dto/pagination.js";
import { NOTIFICATION_TYPES } from "@/modules/notifications/domain/notification-rules.js";

export const notificationResponseSchema = z.object({
  id: z.uuid(),
  type: z.enum(NOTIFICATION_TYPES),
  /** One line, written when it was delivered. */
  title: z.string(),
  /** App path it is about, e.g. "/corrections/{id}"; null for very old items. */
  link: z.string().nullable(),
  deliveredAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});
export type NotificationResponseBody = z.infer<typeof notificationResponseSchema>;
export class NotificationResponse extends createZodDto(notificationResponseSchema) {}

export class NotificationListResponse extends createZodDto(paginated(notificationResponseSchema)) {}

export class UnreadCountResponse extends createZodDto(z.object({ count: z.int() })) {}

export class MarkAllReadResponse extends createZodDto(z.object({ updated: z.int() })) {}
