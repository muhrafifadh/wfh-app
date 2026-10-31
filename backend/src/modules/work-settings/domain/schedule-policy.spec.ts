import { parseTimeOfDay } from "@/common/time/zoned-time.js";
import {
  boundariesFor,
  isScheduledWeekday,
  timeOrderErrors,
  type SchedulePolicy,
} from "@/modules/work-settings/domain/schedule-policy.js";

const t = (value: string) => parseTimeOfDay(value) as number;

const baseline: SchedulePolicy = {
  timezone: "Asia/Jakarta",
  workingDays: [1, 2, 3, 4, 5],
  startTime: t("09:00"),
  endTime: t("17:00"),
  toleranceMinutes: 15,
  checkInOpensAt: t("08:00"),
  checkInClosesAt: t("17:00"),
  checkOutDeadline: t("23:59:59.999"),
};

describe("schedule policy", () => {
  it("gives the baseline boundaries in Asia/Jakarta (PLANS.md Phase 2A)", () => {
    const b = boundariesFor(baseline, "2026-11-02");
    expect({
      opens: b.checkInOpensAt.toISOString(),
      start: b.scheduledStartAt.toISOString(),
      onTime: b.onTimeDeadlineAt.toISOString(),
      end: b.scheduledEndAt.toISOString(),
      closes: b.checkInClosesAt.toISOString(),
      checkOut: b.checkOutClosesAt.toISOString(),
    }).toEqual({
      opens: "2026-11-02T01:00:00.000Z", // 08:00 WIB
      start: "2026-11-02T02:00:00.000Z", // 09:00
      onTime: "2026-11-02T02:15:00.000Z", // 09:15
      end: "2026-11-02T10:00:00.000Z", // 17:00
      closes: "2026-11-02T10:00:00.000Z", // 17:00
      checkOut: "2026-11-02T16:59:59.999Z", // 23:59:59.999
    });
  });

  it("treats Saturday and Sunday as non-working in the baseline", () => {
    expect(isScheduledWeekday(baseline, "2026-11-06")).toBe(true); // Friday
    expect(isScheduledWeekday(baseline, "2026-11-07")).toBe(false); // Saturday
    expect(isScheduledWeekday(baseline, "2026-11-08")).toBe(false); // Sunday
  });

  it("accepts the baseline and equal boundaries where allowed", () => {
    expect(timeOrderErrors(baseline)).toEqual({});
    expect(timeOrderErrors({ ...baseline, checkInOpensAt: t("09:00") })).toEqual({});
    expect(timeOrderErrors({ ...baseline, checkOutDeadline: t("17:00") })).toEqual({});
  });

  it("names each broken ordering rule", () => {
    expect(
      timeOrderErrors({
        startTime: t("09:00"),
        endTime: t("09:00"),
        checkInOpensAt: t("09:30"),
        checkInClosesAt: t("09:30"),
        checkOutDeadline: t("09:00"),
      }),
    ).toEqual({
      checkInOpensAt: expect.any(String),
      endTime: expect.any(String),
      checkInClosesAt: expect.any(String),
      checkOutDeadline: expect.any(String),
    });
  });
});
