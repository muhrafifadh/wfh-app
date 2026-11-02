/** docs/15-background-jobs.md — scheduled with a BullMQ job scheduler, so it runs once per cluster. */
export const VERIFICATION_CLEANUP_QUEUE = "attendance-verification-cleanup";
export const VERIFICATION_CLEANUP_SCHEDULER = "attendance-verification-cleanup-daily";
/** Every day at 03:15 UTC. */
export const VERIFICATION_CLEANUP_CRON = "15 3 * * *";
