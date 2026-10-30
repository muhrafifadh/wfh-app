import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { loadToday } from "@/app/(app)/_components/load-today";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/routes";
import { AttendanceSummary } from "@/features/attendance/components/attendance-summary";
import { RecentAttendance } from "@/features/attendance/components/recent-attendance";
import { TodayCard } from "@/features/attendance/components/today-card";
import { firstDayOf, lastDayOf, monthOf } from "@/features/attendance/dates";
import { formatLongDate, formatMonthYear, greeting } from "@/features/attendance/format";
import { countMyPendingCorrections } from "@/features/corrections/queries";
import { SupportContact } from "@/features/profile/components/support-contact";
import { getMeContext } from "@/features/profile/queries";
import { can, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

// UX_FLOWS.md §6.1 — the employee dashboard. Manager and Admin/HR views arrive in Phase 4D.
export default async function DashboardPage() {
  const user = await requireUser();
  const context = await getMeContext();
  const { organization } = context;
  const firstName = user.name.split(/\s+/)[0] ?? user.name;

  if (!context.employee || !can(user, "attendance:self")) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {firstName}</h1>
        <p className="text-sm text-muted-foreground">{formatLongDate(organization.workDate)}</p>
        <EmptyState
          title="Team and organization dashboards are coming"
          description="Your account has no employee profile, so there's no attendance of your own. Team and organization views arrive in Phase 4D."
        />
      </>
    );
  }

  const today = await loadToday();
  const month = monthOf(organization.workDate);

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {today ? greeting(today.serverTime, organization.timezone) : "Welcome"}, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">{formatLongDate(organization.workDate)}</p>
      </div>
      <TodayCard
        initialToday={today}
        supportContact={<SupportContact contact={organization.supportContact} />}
      />
      <div className="grid max-w-2xl gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{formatMonthYear(month)}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-40" />}>
              <AttendanceSummary from={firstDayOf(month)} to={lastDayOf(month)} compact />
            </Suspense>
          </CardContent>
        </Card>
        {can(user, "correction:submit") && (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Corrections</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Suspense fallback={<Skeleton className="h-8 w-24" />}>
                <PendingCorrections />
              </Suspense>
              <Link
                href={routes.corrections()}
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                View my corrections
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
      <section aria-labelledby="recent-heading" className="flex max-w-2xl flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="recent-heading" className="text-lg font-semibold">
            Recent attendance
          </h2>
          <Link
            href={routes.attendanceHistory()}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </div>
        <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
          <RecentAttendance count={5} today={organization.workDate} />
        </Suspense>
      </section>
    </>
  );
}

async function PendingCorrections() {
  const pending = await countMyPendingCorrections();
  return (
    <p className="text-2xl font-semibold tabular-nums">
      {pending} <span className="text-base font-normal text-muted-foreground">pending</span>
    </p>
  );
}
