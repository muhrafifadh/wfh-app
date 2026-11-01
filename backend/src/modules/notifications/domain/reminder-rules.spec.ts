import {
  checkInReminderEmail,
  checkOutReminderEmail,
  formatClock,
  needsReminder,
  reminderDue,
  reminderKeyOf,
} from "@/modules/notifications/domain/reminder-rules.js";
import { boundariesFor } from "@/modules/work-settings/domain/schedule-policy.js";

const wib = (time: string) => new Date(`2026-11-02T${time}+07:00`);
const hours = (h: number, m = 0) => (h * 60 + m) * 60_000;
const TZ = "Asia/Jakarta";

// The baseline schedule: check-in 08:00–17:00, check-out until 23:59:59.999
const boundaries = boundariesFor(
  {
    timezone: TZ,
    workingDays: [1, 2, 3, 4, 5],
    startTime: hours(9),
    endTime: hours(17),
    toleranceMinutes: 15,
    checkInOpensAt: hours(8),
    checkInClosesAt: hours(17),
    checkOutDeadline: hours(24) - 1,
  },
  "2026-11-02",
);

const due = (kind: "check_in" | "check_out", at: number, now: string, enabled = true) =>
  reminderDue({ kind, setting: { enabled, at }, boundaries, timezone: TZ, now: wib(now) });

describe("reminder rules (DOMAIN_RULES.md §18.4)", () => {
  describe("check-in", () => {
    it("is due from the reminder time until check-in closes", () => {
      expect(due("check_in", hours(9), "08:59:59")).toBeNull();
      expect(due("check_in", hours(9), "09:00:00")).toEqual({ expiresAt: wib("17:00:00") });
    });

    it("stops 2 hours after the reminder time", () => {
      expect(due("check_in", hours(9), "10:59:59")).not.toBeNull();
      expect(due("check_in", hours(9), "11:00:00")).toBeNull();
    });

    it("stops when check-in closes, even within the 2 hours", () => {
      expect(due("check_in", hours(16, 30), "16:59:59")).not.toBeNull();
      expect(due("check_in", hours(16, 30), "17:00:00")).toBeNull();
    });

    it("counts a reminder time before check-in opens from the opening", () => {
      expect(due("check_in", hours(7), "07:30:00")).toBeNull();
      expect(due("check_in", hours(7), "08:00:00")).not.toBeNull();
      expect(due("check_in", hours(7), "09:59:59")).not.toBeNull();
      expect(due("check_in", hours(7), "10:00:00")).toBeNull();
    });

    it("is never due when turned off", () => {
      expect(due("check_in", hours(9), "09:00:00", false)).toBeNull();
    });
  });

  describe("check-out", () => {
    it("is due from the reminder time until the check-out deadline", () => {
      expect(due("check_out", hours(18), "17:59:59")).toBeNull();
      expect(due("check_out", hours(18), "18:00:00")).toEqual({
        expiresAt: new Date("2026-11-02T16:59:59.999Z"),
      });
    });

    it("stops at the deadline", () => {
      expect(due("check_out", hours(23), "23:59:59")).not.toBeNull();
      expect(due("check_out", hours(23), "23:59:59.999")).toBeNull();
    });
  });

  it("asks for check-in only without a record, and check-out only for an open one", () => {
    const open = { checkInAt: wib("09:00:00"), checkOutAt: null };
    const complete = { checkInAt: wib("09:00:00"), checkOutAt: wib("17:00:00") };
    const absent = { checkInAt: null, checkOutAt: null };
    expect(needsReminder("check_in", undefined)).toBe(true);
    expect(needsReminder("check_in", open)).toBe(false);
    expect(needsReminder("check_in", absent)).toBe(false);
    expect(needsReminder("check_out", undefined)).toBe(false);
    expect(needsReminder("check_out", open)).toBe(true);
    expect(needsReminder("check_out", complete)).toBe(false);
    expect(needsReminder("check_out", absent)).toBe(false);
  });

  it("keys one reminder of each kind per employee and work date", () => {
    expect(reminderKeyOf("reminder_check_in", "e1", "2026-11-02")).toBe(
      "reminder_check_in:e1:2026-11-02",
    );
  });

  it("names Indonesian zones and shows other zones by offset", () => {
    expect(formatClock(wib("17:00:00"), TZ)).toBe("17:00 WIB");
    expect(formatClock(wib("17:00:00"), "Asia/Makassar")).toBe("18:00 WITA");
    expect(formatClock(wib("17:00:00"), "Asia/Singapore")).toBe("18:00 GMT+8");
  });

  describe("emails", () => {
    const link = "http://localhost:3001/attendance";

    it("check-in: the day, when check-in closes and the link", () => {
      const email = checkInReminderEmail({
        recipientName: "Dewi",
        workDate: "2026-11-02",
        closesAt: wib("17:00:00"),
        timezone: TZ,
        link,
      });
      expect(email.subject).toBe("Reminder: you haven't checked in today");
      expect(email.text).toContain("You haven't checked in for Monday, 2 November 2026 yet.");
      expect(email.text).toContain("Check-in closes at 17:00 WIB.");
      expect(email.text).toContain(`Check in: ${link}`);
    });

    it("check-out: the check-in time, the deadline and the correction warning", () => {
      const email = checkOutReminderEmail({
        recipientName: "Dewi",
        workDate: "2026-11-02",
        checkInAt: wib("08:47:00"),
        closesAt: new Date("2026-11-02T16:59:59.999Z"),
        timezone: TZ,
        link,
      });
      expect(email.subject).toBe("Reminder: check out when you finish work");
      expect(email.text).toContain("You checked in at 08:47 WIB on Monday, 2 November 2026");
      expect(email.text).toContain("check-out closes at 23:59 WIB");
      expect(email.text).toContain("needs a correction request");
    });
  });
});
