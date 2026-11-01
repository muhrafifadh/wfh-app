// docs/08-data-fetching.md — every TanStack Query key for notifications comes from here.
export const notificationKeys = {
  all: ["notifications"] as const,
  summary: () => [...notificationKeys.all, "summary"] as const,
};
