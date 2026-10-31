import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { paginated } from "@/common/dto/pagination.js";
import { NON_WORKING_REASONS } from "@/modules/holidays/holidays.constants.js";

export const holidayResponseSchema = z.object({
  id: z.uuid(),
  date: z.iso.date(),
  name: z.string(),
  createdBy: z.object({ id: z.uuid(), name: z.string() }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type HolidayResponseBody = z.infer<typeof holidayResponseSchema>;

export const calendarDaySchema = z.object({
  date: z.iso.date(),
  isWorkingDay: z.boolean(),
  /** Null on a working day. */
  reason: z.enum(NON_WORKING_REASONS).nullable(),
  holiday: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  /** The schedule version in force that day. */
  scheduleId: z.uuid().nullable(),
});

export type CalendarDayBody = z.infer<typeof calendarDaySchema>;

export class HolidayResponse extends createZodDto(holidayResponseSchema) {}
export class HolidayListResponse extends createZodDto(paginated(holidayResponseSchema)) {}
export class WorkCalendarResponse extends createZodDto(
  z.object({ items: z.array(calendarDaySchema) }),
) {}
