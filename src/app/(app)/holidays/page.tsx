import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Button } from "@/components/ui/button";
import { AddHolidayButton } from "@/features/holidays/components/add-holiday-button";
import { HolidayTable } from "@/features/holidays/components/holiday-table";
import { holidayListHref, loadHolidaySearchParams } from "@/features/holidays/search-params";
import { getMeContext } from "@/features/profile/queries";
import { can, requireUser } from "@/lib/auth/session";
import { todayIn } from "@/lib/time-zone";

export const metadata: Metadata = { title: "Holidays" };

// Reasonable bounds for a year in the URL; the backend only needs valid dates
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

export default async function HolidaysPage({ searchParams }: PageProps<"/holidays">) {
  const user = await requireUser();
  if (!can(user, "holiday:manage")) return <NoAccess title="Holidays" />;
  const [{ year: requested }, context] = await Promise.all([
    loadHolidaySearchParams(searchParams),
    getMeContext(),
  ]);
  const today = todayIn(context.organization.timezone);
  const current = Number(today.slice(0, 4));
  const year =
    requested !== null && requested >= MIN_YEAR && requested <= MAX_YEAR ? requested : current;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Holidays</h1>
        <div className="ml-auto">
          <AddHolidayButton
            key={year}
            today={today}
            defaultDate={year === current ? today : `${year}-01-01`}
          />
        </div>
      </div>
      <nav aria-label="Year" className="flex items-center gap-2">
        <Button variant="outline" size="icon" asChild>
          <Link href={holidayListHref(year - 1)} aria-label={`Holidays in ${year - 1}`}>
            <ChevronLeftIcon aria-hidden />
          </Link>
        </Button>
        <h2 className="min-w-16 text-center text-lg font-medium tabular-nums" aria-live="polite">
          {year}
        </h2>
        <Button variant="outline" size="icon" asChild>
          <Link href={holidayListHref(year + 1)} aria-label={`Holidays in ${year + 1}`}>
            <ChevronRightIcon aria-hidden />
          </Link>
        </Button>
        {year !== current && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={holidayListHref(current)}>This year</Link>
          </Button>
        )}
      </nav>
      <Suspense key={year} fallback={<TableSkeleton rows={4} label="Loading holidays" />}>
        <HolidayTable year={year} today={today} />
      </Suspense>
    </>
  );
}
