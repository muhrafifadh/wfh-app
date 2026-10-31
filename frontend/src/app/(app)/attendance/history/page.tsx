import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { NoEmployeeProfile } from "@/app/(app)/_components/no-employee-profile";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AttendanceSummary } from "@/features/attendance/components/attendance-summary";
import { HistoryCalendar } from "@/features/attendance/components/history-calendar";
import { HistoryFilters } from "@/features/attendance/components/history-filters";
import { HistoryList } from "@/features/attendance/components/history-list";
import { HISTORY_STATUS_LABEL } from "@/features/attendance/constants";
import {
  firstDayOf,
  historyMonth,
  historyRange,
  lastDayOf,
  monthOf,
  shiftMonth,
} from "@/features/attendance/dates";
import { formatMonthYear } from "@/features/attendance/format";
import { historyHref, loadHistorySearchParams } from "@/features/attendance/search-params";
import { SupportContact } from "@/features/profile/components/support-contact";
import { getMeContext } from "@/features/profile/queries";
import { can, requireUser } from "@/lib/auth/session";
import { formatDayDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My history" };

// UX_FLOWS.md §8 — own records only: the backend scopes /attendance/me to the caller.
export default async function AttendanceHistoryPage({
  searchParams,
}: PageProps<"/attendance/history">) {
  const user = await requireUser();
  if (!can(user, "attendance:self")) return <NoAccess title="My history" />;
  const [filters, context] = await Promise.all([
    loadHistorySearchParams(searchParams),
    getMeContext(),
  ]);
  const heading = <h1 className="text-2xl font-semibold tracking-tight">My history</h1>;
  if (!context.employee) {
    return (
      <>
        {heading}
        <NoEmployeeProfile
          support={<SupportContact contact={context.organization.supportContact} />}
        />
      </>
    );
  }

  const today = context.organization.workDate;
  const monthly = filters.view === "monthly";

  return (
    <>
      {heading}
      <nav aria-label="History view" className="flex gap-1 rounded-lg bg-muted p-1 sm:w-fit">
        <ViewLink href={historyHref({})} active={!monthly}>
          Daily
        </ViewLink>
        <ViewLink href={historyHref({ view: "monthly" })} active={monthly}>
          Monthly
        </ViewLink>
      </nav>
      {monthly ? (
        <MonthlyView month={historyMonth(filters.month, today)} today={today} />
      ) : (
        <DailyView filters={filters} today={today} timeZone={context.organization.timezone} />
      )}
    </>
  );
}

function ViewLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex-1 rounded-md px-4 py-2 text-center text-sm font-medium sm:flex-none",
        active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function DailyView({
  filters,
  today,
  timeZone,
}: {
  filters: Awaited<ReturnType<typeof loadHistorySearchParams>>;
  today: string;
  timeZone: string;
}) {
  const range = historyRange(filters, today);
  const shown = "error" in range ? null : range;
  const key = JSON.stringify(filters);

  return (
    <>
      <HistoryFilters
        key={`${filters.from}|${filters.to}`}
        from={shown?.from ?? filters.from}
        to={shown?.to ?? filters.to}
        today={today}
      />
      {shown ? (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {formatDayDate(shown.from)} – {formatDayDate(shown.to)}
            {filters.status && ` · ${HISTORY_STATUS_LABEL[filters.status]} only`}
          </p>
          <section aria-label="Summary for this range">
            <Suspense key={`${shown.from}|${shown.to}`} fallback={<Skeleton className="h-20" />}>
              <AttendanceSummary from={shown.from} to={shown.to} />
            </Suspense>
          </section>
          <Suspense key={key} fallback={<TableSkeleton rows={5} label="Loading history" />}>
            <HistoryList filters={filters} from={shown.from} to={shown.to} timeZone={timeZone} />
          </Suspense>
        </>
      ) : (
        <Alert variant="destructive">
          <AlertDescription>
            {"error" in range && range.error}{" "}
            <Link href={historyHref({})} className="underline underline-offset-4">
              Reset filters
            </Link>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}

function MonthlyView({ month, today }: { month: string; today: string }) {
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const current = monthOf(today);

  return (
    <>
      <nav aria-label="Month" className="flex items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link
            href={historyHref({ view: "monthly", month: previous })}
            aria-label={formatMonthYear(previous)}
          >
            <ChevronLeftIcon aria-hidden />
          </Link>
        </Button>
        <h2 className="min-w-40 text-center text-lg font-medium" aria-live="polite">
          {formatMonthYear(month)}
        </h2>
        {next <= current ? (
          <Button variant="outline" size="icon" asChild>
            <Link
              href={historyHref({ view: "monthly", month: next })}
              aria-label={formatMonthYear(next)}
            >
              <ChevronRightIcon aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" disabled aria-label="No later months">
            <ChevronRightIcon aria-hidden />
          </Button>
        )}
        {month !== current && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={historyHref({ view: "monthly" })}>This month</Link>
          </Button>
        )}
      </nav>
      <section aria-label={`Summary for ${formatMonthYear(month)}`}>
        <Suspense key={month} fallback={<Skeleton className="h-20" />}>
          <AttendanceSummary from={firstDayOf(month)} to={lastDayOf(month)} />
        </Suspense>
      </section>
      <Suspense key={`grid-${month}`} fallback={<Skeleton className="h-96 rounded-lg" />}>
        <HistoryCalendar month={month} today={today} />
      </Suspense>
    </>
  );
}
