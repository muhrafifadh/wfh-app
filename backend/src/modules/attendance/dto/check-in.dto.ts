import { createZodDto } from "nestjs-zod";
import { z } from "zod";

/**
 * Check-in and check-out take no fields: the time, employee, organization and status
 * all come from the server (PRD ATT-03). Anything sent (e.g. checkInAt) is rejected.
 * No body at all arrives as undefined and counts as empty.
 */
export const attendanceActionSchema = z.preprocess((body) => body ?? {}, z.strictObject({}));

export class AttendanceActionDto extends createZodDto(attendanceActionSchema) {}
