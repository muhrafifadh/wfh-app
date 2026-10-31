// docs/08-data-fetching.md — every TanStack Query key for attendance comes from here.
export const attendanceKeys = {
  all: ["attendance"] as const,
  today: () => [...attendanceKeys.all, "today"] as const,
};
