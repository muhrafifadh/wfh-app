import type { Correction } from "@/features/corrections/schemas";

// Test data: Agus asked to fix Monday 2 November 2026 in Jakarta (UTC+7).

export const aCorrection = (overrides: Partial<Correction> = {}): Correction => ({
  id: "01a18c63-0c1b-7181-901e-9219b6a5bd13",
  attendanceId: "01a18c63-0bc9-7548-a089-70b591453337",
  workDate: "2026-11-02",
  timezone: "Asia/Jakarta",
  status: "pending",
  employee: {
    id: "01a11fa4-1b5f-7d2e-8b88-1e6c2e5d3f21",
    employeeNumber: "EMP-002",
    fullName: "Agus Pratama",
  },
  requestedBy: { id: "01a11fa4-0a4e-7c1d-9a77-0d5b1d4c2e10", name: "Agus Pratama" },
  current: { checkInAt: "2026-11-02T02:42:00.000Z", checkOutAt: null },
  requested: { checkInAt: "2026-11-02T01:58:00.000Z", checkOutAt: "2026-11-02T10:10:00.000Z" },
  changes: ["check_in", "check_out"],
  outcome: {
    current: { status: "late", lateMinutes: 27, workedMinutes: null },
    requested: { status: "present", lateMinutes: 0, workedMinutes: 492 },
  },
  reason: "VPN was down at 08:58; I was online in stand-up from then.",
  submittedAt: "2026-11-03T02:00:00.000Z",
  decision: null,
  canDecide: true,
  ...overrides,
});
