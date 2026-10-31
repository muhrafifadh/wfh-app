import { TODAY_STATES } from "@/features/attendance/constants";
import { aRecord, aToday, SCHEDULE } from "@/features/attendance/fixtures";
import { describeToday, nextBoundary } from "@/features/attendance/today-view";

// UX_FLOWS.md §7.2 — every state the server can return has a design.
describe("describeToday", () => {
  it.each(TODAY_STATES)("has a title and an action for %s", (state) => {
    const view = describeToday(
      aToday({ state, record: state.startsWith("check") ? aRecord() : null }),
    );
    expect(view.title).not.toBe("");
    expect(view.action.kind).toBeDefined();
  });

  it("B: before the window, says when check-in opens", () => {
    const view = describeToday(aToday({ state: "before_window", canCheckIn: false }));
    expect(view).toMatchObject({ title: "Check-in not open yet", action: { kind: "check_in" } });
    expect(view.lines).toContain("Check-in opens at 08:00 WIB.");
  });

  it("C: ready to check in", () => {
    const view = describeToday(aToday());
    expect(view).toMatchObject({ title: "Not checked in", action: { kind: "check_in" } });
    expect(view.lines).toEqual([
      "Check in by 09:15 WIB to be on time.",
      "Check-in closes at 12:00 WIB.",
    ]);
  });

  it("D/E: checked in late, with the API's late minutes, offers check-out", () => {
    const record = aRecord({
      status: "late",
      lateMinutes: 7,
      checkInAt: "2026-10-30T02:22:00.000Z",
    });
    const view = describeToday(
      aToday({ state: "checked_in", canCheckIn: false, canCheckOut: true, record }),
    );
    expect(view).toMatchObject({
      title: "Checked in",
      status: "late",
      action: { kind: "check_out" },
    });
    expect(view.lines).toEqual([
      "Checked in at 09:22:00 WIB.",
      "Checked in 7 minutes after the 09:15 WIB deadline.",
      "Check out by 23:59 WIB.",
    ]);
  });

  it("F: checked out shows both times and the duration, and no more actions", () => {
    const record = aRecord({
      completion: "complete",
      checkOutAt: "2026-10-30T10:39:00.000Z",
      workedMinutes: 462,
    });
    const view = describeToday(aToday({ state: "checked_out", canCheckIn: false, record }));
    expect(view).toMatchObject({
      title: "Done for today",
      status: "present",
      action: { kind: "history" },
    });
    expect(view.lines).toEqual([
      "Checked in at 08:57:00 WIB.",
      "Checked out at 17:39:00 WIB.",
      "Worked 7h 42m.",
    ]);
  });

  it("G: a holiday names the holiday, with no actions", () => {
    const view = describeToday(
      aToday({
        state: "non_working_day",
        canCheckIn: false,
        nonWorkingReason: "holiday",
        holiday: { name: "Maulid Nabi" },
      }),
    );
    expect(view).toMatchObject({ title: "Today is not a working day", action: { kind: "none" } });
    expect(view.lines).toEqual(["It's a holiday: Maulid Nabi."]);
  });

  it("H: window closed points to a correction later", () => {
    expect(describeToday(aToday({ state: "window_closed", canCheckIn: false }))).toMatchObject({
      title: "Today's check-in window has closed",
      action: { kind: "none" },
    });
  });

  it("I: a missed check-out deadline offers a correction for that record", () => {
    const record = aRecord({ incomplete: true });
    expect(
      describeToday(aToday({ state: "check_out_closed", canCheckIn: false, record })),
    ).toMatchObject({
      title: "Missing check-out",
      action: { kind: "request_correction", attendanceId: record.id },
    });
  });

  it("J: no or inactive profile sends you to Admin/HR, with no internal identifiers", () => {
    for (const state of ["no_profile", "inactive"] as const) {
      const view = describeToday(
        aToday({ state, canCheckIn: false, employee: null, schedule: null }),
      );
      expect(view.action).toEqual({ kind: "contact_support" });
      expect(view.lines.join(" ")).not.toMatch(/EMP-|[0-9a-f]{8}-/);
    }
  });
});

describe("nextBoundary", () => {
  it("re-checks when the state would change on its own", () => {
    expect(nextBoundary(aToday({ state: "before_window" }))).toBe(SCHEDULE.checkInOpensAt);
    expect(nextBoundary(aToday())).toBe(SCHEDULE.checkInClosesAt);
    expect(nextBoundary(aToday({ state: "checked_in" }))).toBe(SCHEDULE.checkOutClosesAt);
    expect(nextBoundary(aToday({ state: "checked_out" }))).toBeNull();
  });
});
