import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { routes } from "@/config/routes";
import { Offices } from "@/features/attendance-verification/components/offices";
import { PhotoRequests } from "@/features/attendance-verification/components/photo-requests";
import { VerificationSettingsForm } from "@/features/attendance-verification/components/settings-form";
import { WorkLocationRequests } from "@/features/attendance-verification/components/work-location-requests";
import {
  getVerificationSettings,
  listOffices,
  listPhotoRequests,
  listWorkLocationRequests,
} from "@/features/attendance-verification/queries";
import { can, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Attendance checks" };

// ATTENDANCE_VERIFICATION_PLAN.md §8 — settings, offices (V13), area approvals (V5), photo requests (V12).
export default async function VerificationSettingsPage() {
  const user = await requireUser();
  if (!can(user, "verification:manage")) return <NoAccess title="Attendance checks" />;
  const settings = await getVerificationSettings();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Attendance checks</h1>
        <Link
          href={routes.verificationReview()}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Review results
        </Link>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Methods</CardTitle>
            <CardDescription>
              Off by default. A failed or declined check never blocks attendance or changes its
              status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VerificationSettingsForm settings={settings} />
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Offices</CardTitle>
              <CardDescription>
                Check-ins from these places show as “At office”, for every employee.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-24" />}>
                <OfficeList canLocate={settings.available} />
              </Suspense>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Work-from-home areas</CardTitle>
              <CardDescription>Requests from employees, waiting for approval.</CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-24" />}>
                <PendingAreas />
              </Suspense>
            </CardContent>
          </Card>
          {can(user, "verification:read_photo") && (
            <Card>
              <CardHeader>
                <CardTitle>Photo requests</CardTitle>
                <CardDescription>Employees asking for a copy of their own photo.</CardDescription>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<Skeleton className="h-24" />}>
                  <OpenPhotoRequests />
                </Suspense>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

async function OfficeList({ canLocate }: { canLocate: boolean }) {
  return <Offices offices={await listOffices()} canLocate={canLocate} />;
}

async function PendingAreas() {
  return <WorkLocationRequests requests={await listWorkLocationRequests()} />;
}

async function OpenPhotoRequests() {
  return <PhotoRequests requests={await listPhotoRequests()} />;
}
