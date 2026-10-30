import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ChevronLeftIcon } from "lucide-react";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/routes";
import { RecordDetails, ScheduleSnapshot } from "@/features/attendance/components/record-details";
import { canRequestCorrection, correctionDeadline } from "@/features/attendance/dates";
import { formatLongDate } from "@/features/attendance/format";
import { getAttendance } from "@/features/attendance/queries";
import { attendanceIdSchema, type Attendance } from "@/features/attendance/schemas";
import { CorrectionHistory } from "@/features/corrections/components/correction-history";
import { listCorrectionsForRecord } from "@/features/corrections/queries";
import { getMeContext } from "@/features/profile/queries";
import { can, requireUser } from "@/lib/auth/session";
import { formatDayDate } from "@/lib/format";
import { timeZoneLabel } from "@/lib/time-zone";

export const metadata: Metadata = { title: "Attendance record" };

// UX_FLOWS.md §8.4 — own records only; anyone else's is "not found" (backend scopes it).
export default async function AttendanceRecordPage({ params }: PageProps<"/attendance/[id]">) {
  const user = await requireUser();
  if (!can(user, "attendance:self")) return <NoAccess title="Attendance record" />;
  const { id } = await params;
  if (!attendanceIdSchema.safeParse(id).success) notFound();
  const [record, context] = await Promise.all([getAttendance(id), getMeContext()]);
  if (!record) notFound();
  const zone = record.schedule.timezone;
  const canCorrect = can(user, "correction:submit");

  return (
    <>
      <div className="flex flex-col gap-1">
        <Button variant="ghost" size="sm" className="w-fit" asChild>
          <Link href={routes.attendanceHistory()}>
            <ChevronLeftIcon aria-hidden />
            My history
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{formatLongDate(record.workDate)}</h1>
        <p className="text-sm text-muted-foreground">
          Times in {timeZoneLabel(zone)} ({zone})
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RecordDetails record={record} />
        <ScheduleSnapshot schedule={record.schedule} />
      </div>
      {canCorrect && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Corrections</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <CorrectionCta record={record} today={context.organization.workDate} />
            <Suspense fallback={<Skeleton className="h-24" />}>
              <RecordCorrections id={record.id} timeZone={zone} />
            </Suspense>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function CorrectionCta({ record, today }: { record: Attendance; today: string }) {
  if (record.pendingCorrectionId) {
    return (
      <p className="text-sm">
        A correction for this day is waiting for a decision.{" "}
        <Link
          href={routes.correction(record.pendingCorrectionId)}
          className="text-primary underline-offset-4 hover:underline"
        >
          View the request
        </Link>
      </p>
    );
  }
  const deadline = formatDayDate(correctionDeadline(record.workDate));
  if (!canRequestCorrection(record, today)) {
    return (
      <p className="text-sm text-muted-foreground">
        Corrections for this day could be requested until {deadline}. Contact Admin/HR if something
        is still wrong.
      </p>
    );
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm">Something wrong? You can request a correction until {deadline}.</p>
      <Button asChild>
        <Link href={routes.newCorrection(record.id)}>Request correction</Link>
      </Button>
    </div>
  );
}

async function RecordCorrections({ id, timeZone }: { id: string; timeZone: string }) {
  const corrections = await listCorrectionsForRecord(id);
  if (corrections.length === 0) {
    return <p className="text-sm text-muted-foreground">No corrections for this day.</p>;
  }
  return <CorrectionHistory corrections={corrections} timeZone={timeZone} />;
}
