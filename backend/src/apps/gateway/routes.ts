export type ServiceName = "employee" | "attendance";

/** Under /v1. Everything else goes to the employee service, whose 404 is the standard error. */
const ATTENDANCE_PREFIXES = [
  "attendance",
  "attendance-verification",
  "correction-requests",
  "dashboard",
  "holidays",
  "me/context",
  "notifications",
  "reports",
  "team/attendance",
  "work-calendar",
  "work-schedules",
  "work-settings",
];

/** Which service answers this request URL. A prefix matches whole path segments only. */
export function serviceFor(url: string): ServiceName {
  const path = (url.split("?")[0] ?? "").replace(/^\/v1\//, "").replace(/\/$/, "");
  const attendance = ATTENDANCE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`) || path === `${prefix}.csv`,
  );
  return attendance ? "attendance" : "employee";
}
