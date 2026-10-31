import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { loadToday } from "@/app/(app)/_components/load-today";
import { NoAccess } from "@/app/(app)/_components/no-access";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/routes";
import { RecentAttendance } from "@/features/attendance/components/recent-attendance";
import { TodayCard } from "@/features/attendance/components/today-card";
import { SupportContact } from "@/features/profile/components/support-contact";
import { getMeContext } from "@/features/profile/queries";
import { can, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Today's attendance" };

// UX_FLOWS.md §7 — the employee's main page.
export default async function AttendancePage() {
  const user = await requireUser();
  if (!can(user, "attendance:self")) return <NoAccess title="Today's attendance" />;
  const [today, context] = await Promise.all([loadToday(), getMeContext()]);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s attendance</h1>
      <TodayCard
        initialToday={today}
        supportContact={<SupportContact contact={context.organization.supportContact} />}
      />
      {context.employee && (
        <section aria-labelledby="recent-heading" className="flex max-w-2xl flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 id="recent-heading" className="text-lg font-semibold">
              Recent days
            </h2>
            <Link
              href={routes.attendanceHistory()}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              View history
            </Link>
          </div>
          <Suspense fallback={<Skeleton className="h-40 rounded-lg" />}>
            <RecentAttendance count={3} today={context.organization.workDate} />
          </Suspense>
        </section>
      )}
    </>
  );
}
