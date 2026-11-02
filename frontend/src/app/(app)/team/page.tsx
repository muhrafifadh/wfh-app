import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { EmptyState } from "@/components/shared/empty-state";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { addDays, isIsoDate } from "@/features/attendance/dates";
import { formatLongDate } from "@/features/attendance/format";
import { getMeContext } from "@/features/profile/queries";
import { CountCards } from "@/features/reports/components/count-cards";
import { TeamDateFilter } from "@/features/reports/components/team-date-filter";
import { TeamTable } from "@/features/reports/components/team-table";
import { TEAM_HISTORY_DAYS } from "@/features/reports/constants";
import { getTeamDay } from "@/features/reports/queries";
import { loadTeamSearchParams, teamHref, type TeamFilters } from "@/features/reports/search-params";
import { matchesTeamFilter, TEAM_CARDS } from "@/features/reports/team";
import { ApiError } from "@/lib/api/errors";
import { can, requireUser } from "@/lib/auth/session";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Team" };

// UX_FLOWS.md §10 — a manager's active direct reports on one day (the backend scopes it).
export default async function TeamPage({ searchParams }: PageProps<"/team">) {
  const user = await requireUser();
  if (!can(user, "attendance:read_team")) return <NoAccess title="Team" />;
  const [filters, context] = await Promise.all([
    loadTeamSearchParams(searchParams),
    getMeContext(),
  ]);
  const today = context.organization.workDate;
  const earliest = addDays(today, -(TEAM_HISTORY_DAYS - 1));
  const date =
    isIsoDate(filters.date) && filters.date >= earliest && filters.date <= today
      ? filters.date
      : "";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        {/* Only where the deployment allows attendance checks at all */}
        {env.VERIFICATION_ENABLED && (
          <Link
            href={routes.verificationReview()}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Check-in check results
          </Link>
        )}
      </div>
      <TeamDateFilter key={date} date={date || today} min={earliest} max={today} />
      <Suspense
        key={`${date}|${filters.show}`}
        fallback={<TableSkeleton rows={5} label="Loading your team" />}
      >
        <TeamDayView filters={{ ...filters, date }} />
      </Suspense>
    </>
  );
}

async function TeamDayView({ filters }: { filters: TeamFilters }) {
  let day;
  try {
    day = await getTeamDay(filters.date);
  } catch (error) {
    if (error instanceof ApiError && error.code === "EMPLOYEE_PROFILE_REQUIRED") {
      return (
        <EmptyState
          title="No team to show"
          description="Your account isn't linked to an employee profile, so it has no direct reports."
        />
      );
    }
    throw error;
  }
  const shown = day.items.filter((item) => matchesTeamFilter(item, filters.show));
  // "" is today, and stays out of the URL
  const date = filters.date;

  return (
    <>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {formatLongDate(day.workDate)} · {day.summary.employees} direct report
        {day.summary.employees === 1 ? "" : "s"}
        {!day.isWorkingDay && " · Not a working day"}
      </p>
      <CountCards
        label="Team summary"
        cards={TEAM_CARDS.map(({ filter, label, count }) => ({
          label,
          value: count(day.summary),
          href: teamHref({ date, show: filters.show === filter ? null : filter }),
          active: filters.show === filter,
          hint: filter === "absent" && date === "" ? "Final after the day closes" : undefined,
        }))}
      />
      {day.items.length === 0 ? (
        <EmptyState
          title="No direct reports"
          description="Employees who report to you appear here."
        />
      ) : shown.length === 0 ? (
        <EmptyState
          title="Nobody matches this card"
          action={
            <Button variant="outline" asChild>
              <Link href={teamHref({ date })}>Show everyone</Link>
            </Button>
          }
        />
      ) : (
        <TeamTable items={shown} timeZone={day.timezone} />
      )}
    </>
  );
}
