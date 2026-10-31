import {
  accountStateOf,
  employeeNotices,
  employmentEnded,
} from "@/features/employees/employee-states";
import type { Employee } from "@/features/employees/schemas";

const base: Employee = {
  id: "e1",
  employeeNumber: "EMP-001",
  fullName: "Rina",
  workEmail: "rina@example.test",
  jobTitle: null,
  status: "active",
  employmentStartDate: "2026-01-05",
  employmentEndDate: null,
  division: { id: "d1", code: "ENG", name: "Engineering" },
  manager: null,
  account: {
    id: "u1",
    email: "rina@example.test",
    role: { id: "r1", name: "employee" },
    status: "active",
  },
  createdAt: "2026-01-05T00:00:00.000Z",
  updatedAt: "2026-01-05T00:00:00.000Z",
};
const account = base.account as NonNullable<Employee["account"]>;

describe("employee states", () => {
  it("has no notices when everything lines up", () => {
    expect(employeeNotices(base, "2026-11-02")).toEqual([]);
  });

  it.each([
    ["not linked", { account: null }, "none", /Not linked/],
    ["invited", { account: { ...account, status: "invited" as const } }, "invited", /pending/],
    [
      "inactive employee, active account",
      { status: "inactive" as const },
      "active",
      /inactive but their account can still sign in/,
    ],
    [
      "active employee, disabled account",
      { account: { ...account, status: "deactivated" as const } },
      "deactivated",
      /sign-in is disabled/,
    ],
  ])("tells %s apart", (_, change, state, notice) => {
    const employee = { ...base, ...change };
    expect(accountStateOf(employee)).toBe(state);
    expect(employeeNotices(employee, "2026-11-02")).toEqual([expect.stringMatching(notice)]);
  });

  it("flags an end date that has passed, by the organization's date", () => {
    const employee = { ...base, employmentEndDate: "2026-11-01" };
    expect(employmentEnded(employee, "2026-11-01")).toBe(false);
    expect(employmentEnded(employee, "2026-11-02")).toBe(true);
    expect(employeeNotices(employee, "2026-11-02")).toEqual([
      expect.stringMatching(/end date has passed/),
    ]);
  });
});
