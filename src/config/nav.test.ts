import { navTitleFor, visibleNav, type NavAccess } from "@/config/nav";
import type { Permission } from "@/types/auth";

// The default roles' permissions (backend src/common/types/auth.ts DEFAULT_ROLES).
const EMPLOYEE: Permission[] = ["attendance:self", "correction:submit"];
const MANAGER: Permission[] = [
  ...EMPLOYEE,
  "attendance:read_team",
  "correction:decide_team",
  "report:read_team",
];
const ADMIN_HR: Permission[] = [
  ...EMPLOYEE,
  "attendance:read_all",
  "correction:decide_all",
  "report:read_all",
  "employee:manage",
  "division:manage",
  "policy:manage",
  "holiday:manage",
  "user:read",
  "user:manage",
  "audit:read",
];

const titles = (access: NavAccess) =>
  visibleNav(access).flatMap((section) => section.items.map((item) => item.title));

describe("visibleNav", () => {
  // UX_FLOWS.md §3.3
  it("gives an employee their own attendance only", () => {
    expect(titles({ permissions: EMPLOYEE, hasEmployeeProfile: true })).toEqual([
      "Dashboard",
      "Today's attendance",
      "My history",
      "My corrections",
    ]);
  });

  it("adds the team, review and team reports for a manager", () => {
    expect(titles({ permissions: MANAGER, hasEmployeeProfile: true })).toEqual([
      "Dashboard",
      "Today's attendance",
      "My history",
      "My corrections",
      "Team",
      "Correction review",
      "Reports",
    ]);
  });

  it("gives Admin/HR review, reports and administration, but not Team", () => {
    expect(titles({ permissions: ADMIN_HR, hasEmployeeProfile: false })).toEqual([
      "Dashboard",
      "Correction review",
      "Reports",
      "Employees",
      "Divisions",
      "Holidays",
      "Attendance settings",
      "Users",
      "Audit log",
    ]);
  });

  it("shows the own attendance pages only with an employee profile", () => {
    const withProfile = titles({ permissions: ADMIN_HR, hasEmployeeProfile: true });
    expect(withProfile).toEqual(expect.arrayContaining(["Today's attendance", "My corrections"]));
    expect(titles({ permissions: MANAGER, hasEmployeeProfile: false })).not.toContain("My history");
  });

  it("shows an entry needing either of two permissions to someone with one of them", () => {
    expect(titles({ permissions: ["report:read_all"], hasEmployeeProfile: false })).toContain(
      "Reports",
    );
  });

  it("drops sections left empty", () => {
    expect(
      visibleNav({ permissions: [], hasEmployeeProfile: false }).map((section) => section.label),
    ).toEqual(["Overview"]);
  });
});

describe("navTitleFor", () => {
  it.each([
    ["/dashboard", "Dashboard"],
    ["/attendance", "Today's attendance"],
    ["/attendance/history", "My history"],
    ["/attendance/01a11fa3-9fd3-76d3-9390-2bc41e4671d2", "Today's attendance"],
    ["/corrections/review", "Correction review"],
    ["/profile", "My profile"],
    ["/users/01a11fa3-9fd3-76d3-9390-2bc41e4671d2", "Users"],
  ])("names %s %s", (path, title) => {
    expect(navTitleFor(path)).toBe(title);
  });

  it("doesn't match a path that only shares a prefix", () => {
    expect(navTitleFor("/usersettings")).toBeUndefined();
  });
});
