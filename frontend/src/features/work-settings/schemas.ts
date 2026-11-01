import { z } from "zod";

// Backend response shapes (backend src/modules/work-settings/dto), checked in contract.ts

export const workScheduleSchema = z.object({
  id: z.string(),
  name: z.string(),
  scope: z.enum(["organization"]),
  timezone: z.string(),
  workingDays: z.array(z.int()),
  startTime: z.string(),
  endTime: z.string(),
  toleranceMinutes: z.int(),
  onTimeDeadline: z.string(),
  checkInOpensAt: z.string(),
  checkInClosesAt: z.string(),
  checkOutDeadline: z.string(),
  effectiveFrom: z.iso.date(),
  effectiveTo: z.iso.date().nullable(),
  state: z.enum(["past", "current", "upcoming"]),
  createdBy: z.object({ id: z.string(), name: z.string() }),
  createdAt: z.iso.datetime(),
});
export type WorkSchedule = z.infer<typeof workScheduleSchema>;

export const workScheduleListSchema = z.object({
  items: z.array(workScheduleSchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
});

export const workSettingsSchema = z.object({
  timezone: z.string(),
  supportContact: z.string().nullable(),
  retentionYears: z.int(),
  /** DOMAIN_RULES.md §18.4 — "HH:MM" in the schedule's zone. */
  checkInReminderEnabled: z.boolean(),
  checkInReminderTime: z.string(),
  checkOutReminderEnabled: z.boolean(),
  checkOutReminderTime: z.string(),
  /** Today in the organization. */
  workDate: z.iso.date(),
  /** The earliest date a new schedule may start (DOMAIN_RULES.md §6.2). */
  earliestEffectiveFrom: z.iso.date(),
  currentSchedule: workScheduleSchema.nullable(),
});
export type WorkSettings = z.infer<typeof workSettingsSchema>;

export const schedulePreviewSchema = z.object({
  onTimeDeadline: z.string(),
  days: z.array(
    z.object({
      workDate: z.iso.date(),
      isScheduledWeekday: z.boolean(),
      checkInOpensAt: z.iso.datetime(),
      scheduledStartAt: z.iso.datetime(),
      onTimeDeadlineAt: z.iso.datetime(),
      scheduledEndAt: z.iso.datetime(),
      checkInClosesAt: z.iso.datetime(),
      checkOutClosesAt: z.iso.datetime(),
    }),
  ),
});
export type SchedulePreview = z.infer<typeof schedulePreviewSchema>;

// What we send

export const organizationSettingsSchema = z.object({
  // null when re-validating parsed values in the Server Action
  supportContact: z
    .string()
    .nullable()
    .transform((value) => value ?? "")
    .pipe(z.string().trim().max(255, "Use at most 255 characters"))
    .transform((value) => value || null),
  retentionYears: z.coerce
    .number<string | number>("Enter a number of years")
    .int("Use whole years")
    .min(1, "Keep records for at least 1 year")
    .max(10, "Keep records for at most 10 years"),
});
export type OrganizationSettingsInput = z.input<typeof organizationSettingsSchema>;
export type OrganizationSettings = z.output<typeof organizationSettingsSchema>;

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time");

/** DOMAIN_RULES.md §18.4 — the two reminder emails: on or off, and when. */
export const reminderSettingsSchema = z.object({
  checkInReminderEnabled: z.boolean(),
  checkInReminderTime: timeOfDay,
  checkOutReminderEnabled: z.boolean(),
  checkOutReminderTime: timeOfDay,
});
export type ReminderSettings = z.infer<typeof reminderSettingsSchema>;
/** The form's "23:59", or the "23:59:59.999" it becomes (re-validated by the Server Action). */
const deadline = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:59\.999)?$/, "Enter a time")
  .transform((time) => (time.length === 5 ? `${time}:59.999` : time));

/**
 * A new schedule version. Times are minutes ("09:00"); the check-out deadline covers
 * its whole minute, so "23:59" is sent as 23:59:59.999 (the baseline, DOMAIN_RULES §6.1).
 */
export const scheduleFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(120, "Use at most 120 characters"),
    timezone: z.string().min(1, "Choose a time zone").max(64),
    workingDays: z
      .array(z.int().min(1).max(7))
      .min(1, "Choose at least one working day")
      .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
    startTime: timeOfDay,
    endTime: timeOfDay,
    toleranceMinutes: z.coerce
      .number<string | number>("Enter minutes")
      .int("Use whole minutes")
      .min(0, "Use 0 to 120 minutes")
      .max(120, "Use 0 to 120 minutes"),
    checkInOpensAt: timeOfDay,
    checkInClosesAt: timeOfDay,
    checkOutDeadline: deadline,
    effectiveFrom: z.iso.date("Choose a date"),
  })
  // DOMAIN_RULES.md §6.1, checked here for quick feedback; the backend decides
  .superRefine((value, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    if (value.checkInOpensAt > value.startTime) {
      issue("checkInOpensAt", "Check-in must open by the start time");
    }
    if (value.startTime >= value.endTime) issue("endTime", "End after the start time");
    if (value.checkInOpensAt >= value.checkInClosesAt) {
      issue("checkInClosesAt", "Close check-in after it opens");
    }
    if (value.checkInClosesAt > value.checkOutDeadline.slice(0, 5)) {
      issue("checkOutDeadline", "Check-out can't close before check-in does");
    }
  });
export type ScheduleFormInput = z.input<typeof scheduleFormSchema>;
export type ScheduleForm = z.output<typeof scheduleFormSchema>;
