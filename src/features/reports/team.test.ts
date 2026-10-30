import type { TeamDay, TeamDayItem } from "@/features/reports/schemas";
import { TEAM_CARDS, matchesTeamFilter } from "@/features/reports/team";

const employee = {
  id: "01a11fa4-1b5f-7d2e-8b88-1e6c2e5d3f21",
  employeeNumber: "EMP-002",
  fullName: "Agus",
  division: { id: "01a11fa3-c92d-721c-83e0-70bf24e76653", code: "ENG", name: "Engineering" },
};
const item = (state: TeamDayItem["state"], status?: "present" | "late" | "absent"): TeamDayItem =>
  ({
    employee,
    state,
    record: status ? ({ status } as TeamDayItem["record"]) : null,
  }) as TeamDayItem;

describe("team cards", () => {
  const items = [
    item("checked_out", "present"),
    item("not_checked_out", "late"),
    item("checked_in", "present"),
    item("not_checked_in"),
    item("absent", "absent"),
  ];
  const summary: TeamDay["summary"] = {
    employees: 5,
    present: 2,
    late: 1,
    notCheckedIn: 1,
    notCheckedOut: 1,
    absent: 1,
  };

  it.each(TEAM_CARDS)("$label lists exactly the members its count counts", ({ filter, count }) => {
    expect(items.filter((i) => matchesTeamFilter(i, filter))).toHaveLength(count(summary));
  });

  it("shows everyone without a filter", () => {
    expect(items.filter((i) => matchesTeamFilter(i, null))).toHaveLength(5);
  });
});
