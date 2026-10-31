import { z } from "zod";

/** docs/15-background-jobs.md — queue owned by the users module. */
export const USER_EMAILS_QUEUE = "user-emails";

export const USER_EMAIL_JOBS = ["invitation", "email-verification"] as const;
export type UserEmailJobName = (typeof USER_EMAIL_JOBS)[number];

/** Ids only: the processor loads fresh data and creates the link's token itself. */
export const userEmailJobSchema = z.object({ userId: z.uuid() });
export type UserEmailJob = z.infer<typeof userEmailJobSchema>;

/**
 * Same user, same kind, same minute → one job. Stops double clicks from sending
 * two emails while still allowing a deliberate resend a minute later.
 * (BullMQ job ids can't contain ":".)
 */
export const userEmailJobId = (name: UserEmailJobName, userId: string, now = Date.now()) =>
  `${name}-${userId}-${Math.floor(now / 60_000)}`;
