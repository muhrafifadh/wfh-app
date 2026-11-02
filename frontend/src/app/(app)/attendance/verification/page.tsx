import type { Metadata } from "next";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { MyResults } from "@/features/attendance-verification/components/my-results";
import { listMyResults } from "@/features/attendance-verification/queries";
import { can, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "My check-in evidence" };

/** Decision V12: no in-app photo viewer; employees ask Admin/HR for a copy. */
export default async function MyVerificationPage() {
  const user = await requireUser();
  if (!can(user, "attendance:self")) return <NoAccess title="My check-in evidence" />;
  const results = await listMyResults();

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">My check-in evidence</h1>
      <p className="max-w-prose text-sm text-muted-foreground">
        Results are kept for 90 days and photos for 30. You can&apos;t view photos in the app; ask
        for a copy and Admin/HR will confirm your identity before sharing it.
      </p>
      <MyResults results={results} />
    </>
  );
}
