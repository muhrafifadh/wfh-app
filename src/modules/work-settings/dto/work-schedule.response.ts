import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginated } from "@/common/dto/pagination.js";
import { SCHEDULE_STATES } from "@/modules/work-settings/work-settings.constants.js";

const timeOfDay = z.string().describe("Local time, HH:MM:SS");

export const workScheduleResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  scope: z.enum(["organization"]),
  timezone: z.string(),
  workingDays: z.array(z.int().min(1).max(7)),
  startTime: timeOfDay,
  endTime: timeOfDay,
  toleranceMinutes: z.int(),
  /** startTime + tolerance: a check-in at or before this is on time. */
  onTimeDeadline: timeOfDay,
  checkInOpensAt: timeOfDay,
  checkInClosesAt: timeOfDay,
  checkOutDeadline: z.string().describe("Local time, HH:MM:SS.sss"),
  effectiveFrom: z.iso.date(),
  /** Null while no later version replaces it. */
  effectiveTo: z.iso.date().nullable(),
  /** Relative to today's work date. */
  state: z.enum(SCHEDULE_STATES),
  createdBy: z.object({ id: z.uuid(), name: z.string() }),
  createdAt: z.iso.datetime(),
});

export type WorkScheduleResponseBody = z.infer<typeof workScheduleResponseSchema>;

/** The UTC instants of one work date under a schedule. */
export const scheduleBoundariesSchema = z.object({
  workDate: z.iso.date(),
  /** The weekday is a working day (holidays aren't considered here). */
  isScheduledWeekday: z.boolean(),
  checkInOpensAt: z.iso.datetime(),
  scheduledStartAt: z.iso.datetime(),
  onTimeDeadlineAt: z.iso.datetime(),
  scheduledEndAt: z.iso.datetime(),
  checkInClosesAt: z.iso.datetime(),
  checkOutClosesAt: z.iso.datetime(),
});

export type ScheduleBoundariesBody = z.infer<typeof scheduleBoundariesSchema>;

export class WorkScheduleResponse extends createZodDto(workScheduleResponseSchema) {}
export class WorkScheduleListResponse extends createZodDto(paginated(workScheduleResponseSchema)) {}
export class WorkSchedulePreviewResponse extends createZodDto(
  z.object({
    onTimeDeadline: timeOfDay,
    /** The first days from effectiveFrom. */
    days: z.array(scheduleBoundariesSchema),
  }),
) {}
