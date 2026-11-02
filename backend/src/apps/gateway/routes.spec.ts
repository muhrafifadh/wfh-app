import { serviceFor } from "@/apps/gateway/routes.js";

describe("serviceFor", () => {
  it.each([
    ["/v1/attendance/today", "attendance"],
    ["/v1/attendance-verification/me", "attendance"],
    ["/v1/attendance-verification/offices/1", "attendance"],
    ["/v1/correction-requests?page=1", "attendance"],
    ["/v1/reports/attendance.csv?from=2026-11-02", "attendance"],
    ["/v1/team/attendance/today", "attendance"],
    ["/v1/me/context", "attendance"],
    ["/v1/notifications", "attendance"],
    ["/v1/me/employee", "employee"],
    ["/v1/auth/login", "employee"],
    ["/v1/employees/1", "employee"],
    ["/v1/audit-logs", "employee"],
    ["/v1/uploads", "employee"],
    ["/v1/unknown", "employee"],
  ])("sends %s to the %s service", (url, service) => {
    expect(serviceFor(url)).toBe(service);
  });

  it("matches whole path segments, not prefixes of a longer name", () => {
    expect(serviceFor("/v1/attendances")).toBe("employee");
    expect(serviceFor("/v1/teams")).toBe("employee");
  });
});
