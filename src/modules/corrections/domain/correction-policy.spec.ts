import {
  canSubmitAt,
  proposalErrors,
  resultingPair,
  submissionClosesAt,
} from "@/modules/corrections/domain/correction-policy.js";

const wib = (date: string, time: string) => new Date(`${date}T${time}+07:00`);
const WORK_DATE = "2026-11-02";
const context = {
  workDate: WORK_DATE,
  timeZone: "Asia/Jakarta",
  now: wib("2026-11-03", "10:00:00"),
};

describe("correction policy", () => {
  describe("submission deadline (§11.2)", () => {
    it("closes at midnight starting the eighth day, in the record's zone", () => {
      expect(submissionClosesAt(WORK_DATE, "Asia/Jakarta")).toEqual(wib("2026-11-10", "00:00:00"));
    });

    it.each([
      ["2026-11-03", "00:00:00", true],
      ["2026-11-09", "23:59:59", true],
      ["2026-11-09", "23:59:59.999", true],
      ["2026-11-10", "00:00:00", false],
      ["2026-11-10", "00:00:01", false],
    ] as const)("at %s %s WIB: %s", (date, time, allowed) => {
      expect(canSubmitAt(wib(date, time), WORK_DATE, "Asia/Jakarta")).toBe(allowed);
    });
  });

  describe("proposal (§11.4)", () => {
    const absent = { checkInAt: null, checkOutAt: null };
    const open = { checkInAt: wib(WORK_DATE, "09:30:00"), checkOutAt: null };
    const complete = {
      checkInAt: wib(WORK_DATE, "09:30:00"),
      checkOutAt: wib(WORK_DATE, "17:00:00"),
    };

    it("keeps current values the proposal doesn't change", () => {
      expect(resultingPair(complete, { checkOutAt: wib(WORK_DATE, "18:00:00") })).toEqual({
        checkInAt: complete.checkInAt,
        checkOutAt: wib(WORK_DATE, "18:00:00"),
      });
    });

    it.each([
      [
        "a forgotten check-in on an absent record",
        absent,
        { checkInAt: wib(WORK_DATE, "08:55:00") },
      ],
      [
        "a full day on an absent record",
        absent,
        { checkInAt: wib(WORK_DATE, "08:55:00"), checkOutAt: wib(WORK_DATE, "17:05:00") },
      ],
      ["a forgotten check-out", open, { checkOutAt: wib(WORK_DATE, "17:00:00") }],
      ["an earlier check-in", complete, { checkInAt: wib(WORK_DATE, "09:00:00") }],
      ["check-out equal to check-in", open, { checkOutAt: wib(WORK_DATE, "09:30:00") }],
    ])("accepts %s", (_name, current, proposal) => {
      expect(proposalErrors(current, proposal, context)).toEqual({});
    });

    it.each([
      [
        "a check-out without any check-in",
        absent,
        { checkOutAt: wib(WORK_DATE, "17:00:00") },
        { requestedCheckInAt: ["Required: the record has no check-in"] },
      ],
      [
        "a check-out before the check-in",
        open,
        { checkOutAt: wib(WORK_DATE, "09:29:59") },
        { requestedCheckOutAt: ["Must be at or after the check-in"] },
      ],
      [
        "a time on another day (in the record's zone)",
        open,
        { checkOutAt: new Date("2026-11-02T17:00:00Z") }, // 00:00 on 3 Nov in Jakarta
        { requestedCheckOutAt: ["Must be on 2026-11-02 (Asia/Jakarta)"] },
      ],
      [
        "a time in the future",
        open,
        { checkOutAt: wib(WORK_DATE, "17:00:00") },
        { requestedCheckOutAt: ["Can't be in the future"] },
        wib(WORK_DATE, "12:00:00"),
      ],
      [
        "no change",
        complete,
        { checkInAt: wib(WORK_DATE, "09:30:00") },
        { requestedCheckInAt: ["Same as the current value"] },
      ],
    ])("rejects %s", (_name, current, proposal, errors, now = context.now) => {
      expect(proposalErrors(current, proposal, { ...context, now })).toEqual(errors);
    });
  });
});
