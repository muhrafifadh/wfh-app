import { z } from "zod";

/** docs/15-background-jobs.md — queue owned by the auth module. */
export const PASSWORD_RESET_QUEUE = "password-reset-emails";

/** The user id only: the processor creates the reset token itself, so it never sits in Redis. */
export const passwordResetJobSchema = z.object({ userId: z.uuid() });
export type PasswordResetJob = z.infer<typeof passwordResetJobSchema>;

/** One job per user per minute, so repeated clicks send one email. */
export const passwordResetJobId = (userId: string, now = Date.now()) =>
  `password-reset-${userId}-${Math.floor(now / 60_000)}`;
