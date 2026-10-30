// Attendance rows and their API shape, shared by attendance and the read-only
// team/report views (ARCHITECTURE.md §6.7), so every endpoint shows a record the same way.

import { fromDateColumn } from "@/common/time/zoned-time.js";
import type { Prisma } from "@/generated/prisma/client.js";
import { isIncomplete } from "@/modules/attendance/domain/attendance-calculator.js";
import type { AttendanceResponseBody } from "@/modules/attendance/dto/attendance.response.js";
import type { ScheduleBoundaries } from "@/modules/work-settings/domain/schedule-policy.js";

export const attendanceRow = {
  id: true,
  organizationId: true,
  employeeId: true,
  workScheduleId: true,
  workDate: true,
  status: true,
  completion: true,
  source: true,
  checkInAt: true,
  checkOutAt: true,
  lateMinutes: true,
  workedMinutes: true,
  scheduleTimezone: true,
  scheduledStartAt: true,
  scheduledEndAt: true,
  onTimeDeadlineAt: true,
  checkInOpensAt: true,
  checkInClosesAt: true,
  checkOutClosesAt: true,
  version: true,
  correctedAt: true,
  createdAt: true,
  updatedAt: true,
  pendingCorrection: { select: { id: true } },
} satisfies Prisma.AttendanceSelect;

export type AttendanceRow = Prisma.AttendanceGetPayload<{ select: typeof attendanceRow }>;

export const snapshotOf = (row: AttendanceRow): ScheduleBoundaries & { timezone: string } => ({
  timezone: row.scheduleTimezone,
  workDate: fromDateColumn(row.workDate),
  checkInOpensAt: row.checkInOpensAt,
  scheduledStartAt: row.scheduledStartAt,
  onTimeDeadlineAt: row.onTimeDeadlineAt,
  scheduledEndAt: row.scheduledEndAt,
  checkInClosesAt: row.checkInClosesAt,
  checkOutClosesAt: row.checkOutClosesAt,
});

export const toScheduleBody = (b: ScheduleBoundaries & { timezone: string }) => ({
  timezone: b.timezone,
  checkInOpensAt: b.checkInOpensAt.toISOString(),
  scheduledStartAt: b.scheduledStartAt.toISOString(),
  onTimeDeadlineAt: b.onTimeDeadlineAt.toISOString(),
  scheduledEndAt: b.scheduledEndAt.toISOString(),
  checkInClosesAt: b.checkInClosesAt.toISOString(),
  checkOutClosesAt: b.checkOutClosesAt.toISOString(),
});

/** Prisma row → response body. `incomplete` depends on `now`. */
export const toAttendance = (row: AttendanceRow, now: Date): AttendanceResponseBody => ({
  id: row.id,
  workDate: fromDateColumn(row.workDate),
  status: row.status,
  completion: row.completion,
  incomplete: isIncomplete(row, now),
  source: row.source,
  checkInAt: row.checkInAt?.toISOString() ?? null,
  checkOutAt: row.checkOutAt?.toISOString() ?? null,
  lateMinutes: row.lateMinutes,
  workedMinutes: row.workedMinutes,
  corrected: row.correctedAt !== null,
  pendingCorrectionId: row.pendingCorrection?.id ?? null,
  schedule: toScheduleBody(snapshotOf(row)),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
