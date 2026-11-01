/** docs/15-background-jobs.md — scheduled notification work, owned by the notifications module. */
export const NOTIFICATION_JOBS_QUEUE = "notification-jobs";

export const NOTIFICATION_JOB_NAMES = {
  /** Every 5 minutes: creates the reminders due now (DOMAIN_RULES.md §18.4). */
  remindersTick: "reminders-tick",
  /** Daily: deletes notifications past retention (§18.5). */
  purge: "purge-notifications",
} as const;

export const REMINDERS_TICK_SCHEDULER = "reminders-tick";
export const REMINDERS_TICK_CRON = "*/5 * * * *";

export const PURGE_NOTIFICATIONS_SCHEDULER = "purge-notifications-daily";
/** Every day at 03:45 UTC. */
export const PURGE_NOTIFICATIONS_CRON = "45 3 * * *";
