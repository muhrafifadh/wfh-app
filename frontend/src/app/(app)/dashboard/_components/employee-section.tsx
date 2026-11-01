import Link from "next/link";
import { Suspense } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/routes";
import { AttendanceSummary } from "@/features/attendance/components/attendance-summary";
import { RecentAttendance } from "@/features/attendance/components/recent-attendance";
import { TodayCard } from "@/features/attendance/components/today-card";
import { firstDayOf, lastDayOf, monthOf } from "@/features/attendance/dates";
import { formatMonthYear } from "@/features/attendance/format";
import type { Today } from "@/features/attendance/schemas";
import { countMyPendingCorrections } from "@/features/corrections/queries";
import { SupportContact } from "@/features/profile/components/support-contact";

/**
 * UX_FLOWS.md §6.1 — today's card, this month, my corrections and recent days. Phones
 * stack them in that order; wide screens put this month and my corrections in a side
 * column next to today's card and recent days.
 */
export function EmployeeSection({
  today,
  workDate,
  supportContact,
  canRequestCorrections,
}: {
  today: Today | null;
  workDate: string;
  supportContact: string | null;
  canRequestCorrections: boolean;
}) {
  const month = monthOf(workDate);
  return (
    <section aria-label="My attendance" className="grid items-start gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <TodayCard
          initialToday={today}
          supportContact={<SupportContact contact={supportContact} />}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:row-span-2 lg:grid-cols-1">
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
        {canRequestCorrections && (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>My corrections</h2>
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
      <div className="flex flex-col gap-3 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Recent attendance</h2>
          <Link
            href={routes.attendanceHistory()}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            View all
          </Link>
        </div>
        <Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
          <RecentAttendance count={5} today={workDate} />
        </Suspense>
      </div>
    </section>
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
