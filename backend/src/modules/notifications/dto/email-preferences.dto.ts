import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/** DOMAIN_RULES.md §18.7 — which notifications the caller also gets by email. */
export const emailPreferencesSchema = z.strictObject({
  reviewRequestsEmail: z.boolean(),
  correctionUpdatesEmail: z.boolean(),
  checkInReminderEmail: z.boolean(),
  checkOutReminderEmail: z.boolean(),
});

export type EmailPreferencesInput = z.infer<typeof emailPreferencesSchema>;

/** All four, every time: the form sends the whole set. */
export class UpdateEmailPreferencesDto extends createZodDto(emailPreferencesSchema) {}

export class EmailPreferencesResponse extends createZodDto(emailPreferencesSchema) {}
