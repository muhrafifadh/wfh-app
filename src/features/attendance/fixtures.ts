import type { Attendance, Today } from "@/features/attendance/schemas";

// Test data: Friday 30 October 2026 in Jakarta (UTC+7), 09:00–17:00, 15 min tolerance.

export const SCHEDULE = {
  timezone: "Asia/Jakarta",
  checkInOpensAt: "2026-10-30T01:00:00.000Z", // 08:00
  scheduledStartAt: "2026-10-30T02:00:00.000Z", // 09:00
  onTimeDeadlineAt: "2026-10-30T02:15:00.000Z", // 09:15
  scheduledEndAt: "2026-10-30T10:00:00.000Z", // 17:00
  checkInClosesAt: "2026-10-30T05:00:00.000Z", // 12:00
  checkOutClosesAt: "2026-10-30T16:59:59.999Z", // 23:59:59.999
};

export const aRecord = (overrides: Partial<Attendance> = {}): Attendance => ({
  id: "01a11fa3-9fd3-76d3-9390-2bc41e4671d2",
  workDate: "2026-10-30",
  status: "present",
  completion: "open",
  incomplete: false,
  source: "self_service",
  checkInAt: "2026-10-30T01:57:00.000Z", // 08:57
  checkOutAt: null,
  lateMinutes: 0,
  workedMinutes: null,
  corrected: false,
  pendingCorrectionId: null,
  schedule: SCHEDULE,
  createdAt: "2026-10-30T01:57:00.000Z",
  updatedAt: "2026-10-30T01:57:00.000Z",
  ...overrides,
});

export const aToday = (overrides: Partial<Today> = {}): Today => ({
  serverTime: "2026-10-30T01:52:14.000Z", // 08:52:14
  workDate: "2026-10-30",
  timezone: "Asia/Jakarta",
  state: "ready_to_check_in",
  canCheckIn: true,
  canCheckOut: false,
  nonWorkingReason: null,
  holiday: null,
  schedule: SCHEDULE,
  record: null,
  employee: {
    id: "01a11fa4-1b5f-7d2e-8b88-1e6c2e5d3f21",
    employeeNumber: "EMP-001",
    fullName: "Rina Wijaya",
  },
  supportContact: "hr@example.test",
  ...overrides,
});
