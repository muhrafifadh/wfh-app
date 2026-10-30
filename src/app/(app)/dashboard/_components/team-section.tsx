import Link from "next/link";
import { Suspense } from "react";

import { AttendanceBadges } from "@/components/shared/attendance-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/routes";
import { addDays, isoWeekday } from "@/features/attendance/dates";
import { changeSummary } from "@/features/corrections/format";
import { listReviewQueue } from "@/features/corrections/queries";
import { CountCards } from "@/features/reports/components/count-cards";
import { RefreshBar } from "@/features/reports/components/refresh-bar";
import { TEAM_DAY_STATE_LABEL } from "@/features/reports/constants";
import { getReport, getTeamDay } from "@/features/reports/queries";
import { reportHref, teamHref } from "@/features/reports/search-params";
import { TEAM_CARDS } from "@/features/reports/team";
import { ApiError } from "@/lib/api/errors";
import { formatDayDate } from "@/lib/format";

/**
 * UX_FLOWS.md §6.2 — the manager's team today (cards link to the filtered team list),
 * this week's late and absent days, pending requests and each direct report's status.
 */
export async function TeamSection({
  workDate,
  canDecide,
  canReport,
}: {
  workDate: string;
  canDecide: boolean;
  canReport: boolean;
}) {
  let day;
  try {
    day = await getTeamDay("");
  } catch (error) {
    // A manager role without an employee profile leads no team
    if (error instanceof ApiError && error.code === "EMPLOYEE_PROFILE_REQUIRED") return null;
    throw error;
  }
  const weekStart = addDays(workDate, 1 - isoWeekday(workDate));

  return (
    <section aria-labelledby="team-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="team-heading" className="text-xl font-semibold tracking-tight">
          My team today
        </h2>
        <RefreshBar serverTime={day.serverTime} timeZone={day.timezone} />
      </div>
      {day.items.length === 0 ? (
        <EmptyState
          title="No direct reports"
          description="Employees who report to you appear here."
        />
      ) : (
        <>
          <CountCards
            label="Team today"
            cards={TEAM_CARDS.map(({ filter, label, count }) => ({
              label,
              value: count(day.summary),
              href: teamHref({ show: filter }),
              hint: filter === "absent" ? "Final after the day closes" : undefined,
            }))}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {canReport && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h3>This week</h3>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<Skeleton className="h-16" />}>
                    <WeekSummary from={weekStart} to={workDate} />
                  </Suspense>
                </CardContent>
              </Card>
            )}
            {canDecide && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    <h3>Pending corrections</h3>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<Skeleton className="h-24" />}>
                    <PendingRequests />
                  </Suspense>
                </CardContent>
              </Card>
            )}
          </div>
          <Card>
            <CardHeader>
              <CardTitle>
                <h3>Direct reports</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y">
                {day.items.map((item) => (
                  <li key={item.employee.id} className="flex flex-wrap items-center gap-2 py-2">
                    <Link
                      href={routes.teamMember(item.employee.id)}
                      className="min-w-0 flex-1 font-medium underline-offset-4 hover:underline"
                    >
                      {item.employee.fullName}
                    </Link>
                    {item.record ? (
                      <AttendanceBadges record={item.record} />
                    ) : (
                      <Badge variant="outline">{TEAM_DAY_STATE_LABEL[item.state]}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}

async function WeekSummary({ from, to }: { from: string; to: string }) {
  const { summary } = await getReport({ from, to, pageSize: 1 });
  return (
    <dl className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border p-3">
        <dt className="text-sm text-muted-foreground">Late days</dt>
        <dd className="text-2xl font-semibold tabular-nums">
          <Link
            href={reportHref({ from, to, status: "late" })}
            className="underline-offset-4 hover:underline"
          >
            {summary.late}
          </Link>
        </dd>
      </div>
      <div className="rounded-lg border p-3">
        <dt className="text-sm text-muted-foreground">Absent days</dt>
        <dd className="text-2xl font-semibold tabular-nums">
          <Link
            href={reportHref({ from, to, status: "absent" })}
            className="underline-offset-4 hover:underline"
          >
            {summary.absent}
          </Link>
        </dd>
      </div>
      <p className="col-span-2 text-xs text-muted-foreground">
        {formatDayDate(from)} – {formatDayDate(to)}. Today&apos;s absences count once the day
        closes.
      </p>
    </dl>
  );
}

async function PendingRequests() {
  const queue = await listReviewQueue(
    { status: "pending", employeeId: null, divisionId: null, page: 1 },
    5,
  );
  if (queue.total === 0) return <p className="text-sm text-muted-foreground">Nothing to review.</p>;
  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y text-sm">
        {queue.items.map((correction) => (
          <li key={correction.id} className="flex flex-wrap items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {correction.employee.fullName} · {formatDayDate(correction.workDate)}
              </p>
              <p className="text-muted-foreground tabular-nums">{changeSummary(correction)}</p>
            </div>
            <Button size="sm" variant="outline" asChild>
              <Link href={routes.correction(correction.id)}>Review</Link>
            </Button>
          </li>
        ))}
      </ul>
      {queue.total > queue.items.length && (
        <Link
          href={routes.correctionReview()}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          All {queue.total} pending requests
        </Link>
      )}
    </div>
  );
}
