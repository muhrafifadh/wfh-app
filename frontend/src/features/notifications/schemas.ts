import { z } from "zod";

// Backend response shapes (backend src/modules/notifications/dto), checked in contract.ts

export const NOTIFICATION_TYPES = [
  "correction_submitted",
  "correction_approved",
  "correction_rejected",
  "reminder_check_in",
  "reminder_check_out",
] as const;

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string(),
  /** App path, e.g. "/corrections/…"; null for very old items. */
  link: z.string().nullable(),
  deliveredAt: z.iso.datetime(),
  readAt: z.iso.datetime().nullable(),
});
export type Notification = z.infer<typeof notificationSchema>;

export const notificationListSchema = z.object({
  items: z.array(notificationSchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
});
export type NotificationList = z.infer<typeof notificationListSchema>;

export const unreadCountSchema = z.object({ count: z.int() });
export const markAllReadSchema = z.object({ updated: z.int() });

/** What the header bell polls (app/api/notifications/summary). */
export const notificationSummarySchema = z.object({
  unread: z.int(),
  items: z.array(notificationSchema),
});
export type NotificationSummary = z.infer<typeof notificationSummarySchema>;

/** DOMAIN_RULES.md §18.7 — which notifications also come by email. Sent and received whole. */
export const emailPreferencesSchema = z.object({
  reviewRequestsEmail: z.boolean(),
  correctionUpdatesEmail: z.boolean(),
  checkInReminderEmail: z.boolean(),
  checkOutReminderEmail: z.boolean(),
});
export type EmailPreferences = z.infer<typeof emailPreferencesSchema>;

export const notificationIdSchema = z.uuid();
