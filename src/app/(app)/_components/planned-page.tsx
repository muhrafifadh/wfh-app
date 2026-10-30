import { NoAccess } from "@/app/(app)/_components/no-access";
import { NoEmployeeProfile } from "@/app/(app)/_components/no-employee-profile";
import { EmptyState } from "@/components/shared/empty-state";
import { getMeContext } from "@/features/profile/queries";
import { canAny, requireUser } from "@/lib/auth/session";
import type { Permission } from "@/types/auth";

/**
 * A nav destination whose feature lands in a later phase (PLANS.md). It already checks
 * access like the real page will, so the nav and the route agree. Replace it, don't extend it.
 */
export async function PlannedPage({
  title,
  description,
  phase,
  anyOf,
  needsEmployeeProfile = false,
}: {
  title: string;
  description: string;
  phase: string;
  anyOf: readonly Permission[];
  needsEmployeeProfile?: boolean;
}) {
  const user = await requireUser();
  const heading = <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>;

  if (!canAny(user, anyOf)) return <NoAccess title={title} />;
  if (needsEmployeeProfile && !(await getMeContext()).employee) {
    return (
      <>
        {heading}
        <NoEmployeeProfile />
      </>
    );
  }
  return (
    <>
      {heading}
      <EmptyState title="Coming soon" description={`${description} Arrives in Phase ${phase}.`} />
    </>
  );
}
