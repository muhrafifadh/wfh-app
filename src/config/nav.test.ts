import { navTitleFor, visibleNav } from "@/config/nav";

describe("visibleNav", () => {
  it("hides Users and the audit log from someone without their permissions", () => {
    expect(visibleNav([]).map((item) => item.title)).not.toContain("Users");
    expect(visibleNav(["user:read"]).map((item) => item.title)).toContain("Users");
    expect(visibleNav(["user:read"]).map((item) => item.title)).not.toContain("Audit log");
    expect(visibleNav(["audit:read"]).map((item) => item.title)).toContain("Audit log");
  });

  it("always shows entries that need no permission", () => {
    expect(visibleNav([]).map((item) => item.title)).toEqual(["Dashboard", "Files"]);
  });
});

describe("navTitleFor", () => {
  it.each([
    ["/dashboard", "Dashboard"],
    ["/files", "Files"],
    ["/users/01a11fa3-9fd3-76d3-9390-2bc41e4671d2", "Users"],
  ])("names %s %s", (path, title) => {
    expect(navTitleFor(path)).toBe(title);
  });

  it("doesn't match a path that only shares a prefix", () => {
    expect(navTitleFor("/usersettings")).toBeUndefined();
  });
});
