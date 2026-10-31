import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChevronLeftIcon } from "lucide-react";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { AttendanceBadges } from "@/components/shared/attendance-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { canRequestCorrection, correctionDeadline } from "@/features/attendance/dates";
import { formatLongDate, timesLine } from "@/features/attendance/format";
import { getAttendance } from "@/features/attendance/queries";
import { attendanceIdSchema } from "@/features/attendance/schemas";
import { CorrectionRequestForm } from "@/features/corrections/components/correction-request-form";
import { getMeContext } from "@/features/profile/queries";
import { can, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Request a correction" };

// UX_FLOWS.md §9.1 — for one of the caller's own records (the backend checks it's theirs).
export default async function NewCorrectionPage({ searchParams }: PageProps<"/corrections/new">) {
  const user = await requireUser();
  if (!can(user, "correction:submit")) return <NoAccess title="Request a correction" />;
  const { attendanceId } = await searchParams;
  const id = attendanceIdSchema.safeParse(attendanceId);
  if (!id.success) notFound();
  const [record, context] = await Promise.all([getAttendance(id.data), getMeContext()]);
  if (!record) notFound();
  const deadline = formatLongDate(correctionDeadline(record.workDate));

  const back = (
    <Button variant="ghost" size="sm" className="w-fit" asChild>
      <Link href={routes.attendanceRecord(record.id)}>
        <ChevronLeftIcon aria-hidden />
        {formatLongDate(record.workDate)}
      </Link>
    </Button>
  );
  const heading = (
    <div className="flex flex-col gap-1">
      {back}
      <h1 className="text-2xl font-semibold tracking-tight">Request a correction</h1>
      <p className="text-sm text-muted-foreground">For {formatLongDate(record.workDate)}</p>
    </div>
  );

  if (record.pendingCorrectionId) {
    return (
      <>
        {heading}
        <EmptyState
          title="A correction for this day is already pending"
          description="Wait for its decision; you can request another one afterwards if needed."
          action={
            <Button asChild>
              <Link href={routes.correction(record.pendingCorrectionId)}>
                Open the pending request
              </Link>
            </Button>
          }
        />
      </>
    );
  }
  if (!canRequestCorrection(record, context.organization.workDate)) {
    return (
      <>
        {heading}
        <EmptyState
          title="Corrections for this day are closed"
          description={`Corrections can only be requested within 7 days (until ${deadline}). Contact Admin/HR.`}
        />
      </>
    );
  }

  return (
    <>
      {heading}
      <section
        aria-labelledby="current-heading"
        className="flex max-w-2xl flex-col gap-2 rounded-lg border p-4"
      >
        <h2 id="current-heading" className="text-base font-semibold">
          Recorded now
        </h2>
        <AttendanceBadges record={record} />
        <p className="text-sm tabular-nums">{timesLine(record)}</p>
      </section>
      <CorrectionRequestForm
        attendanceId={record.id}
        workDate={record.workDate}
        timezone={record.schedule.timezone}
        current={{ checkInAt: record.checkInAt, checkOutAt: record.checkOutAt }}
        deadline={deadline}
      />
    </>
  );
}
