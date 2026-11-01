import { z } from "zod";

/** docs/15-background-jobs.md — queue owned by the notifications module. */
export const NOTIFICATION_EMAILS_QUEUE = "notification-emails";
export const NOTIFICATION_EMAIL_JOB = "deliver";

/** The id only: the processor loads the notification and current data when it runs. */
export const notificationEmailJobSchema = z.object({ notificationId: z.uuid() });
export type NotificationEmailJob = z.infer<typeof notificationEmailJobSchema>;

/** One job per notification, so a repeated event can't queue it twice. */
export const notificationEmailJobId = (notificationId: string) => `notification-${notificationId}`;
