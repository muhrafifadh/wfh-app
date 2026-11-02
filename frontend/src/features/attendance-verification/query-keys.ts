// docs/08-data-fetching.md — every TanStack Query key for attendance verification.
export const verificationKeys = {
  all: ["attendance-verification"] as const,
  mine: () => [...verificationKeys.all, "mine"] as const,
};
