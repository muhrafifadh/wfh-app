import { EmptyState } from "@/components/shared/empty-state";

/** UX_FLOWS.md §7.2 J: attendance pages for an account without an employee profile. */
export function NoEmployeeProfile({ support }: { support?: React.ReactNode }) {
  return (
    <EmptyState
      title="No employee profile"
      description="Your account doesn't have an active employee profile, so there's no attendance to show."
      action={support && <p className="text-sm">Contact Admin/HR: {support}</p>}
    />
  );
}
