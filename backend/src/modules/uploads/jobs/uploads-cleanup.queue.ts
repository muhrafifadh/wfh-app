/** docs/15-background-jobs.md — scheduled with a BullMQ job scheduler, so it runs once per cluster. */
export const UPLOADS_CLEANUP_QUEUE = "uploads-cleanup";
export const UPLOADS_CLEANUP_SCHEDULER = "uploads-cleanup-daily";
/** Every day at 03:00 UTC. */
export const UPLOADS_CLEANUP_CRON = "0 3 * * *";
