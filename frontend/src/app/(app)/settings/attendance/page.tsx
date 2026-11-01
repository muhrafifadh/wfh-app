import type { Metadata } from "next";

import { NoAccess } from "@/app/(app)/_components/no-access";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OrganizationSettingsForm } from "@/features/work-settings/components/organization-settings-form";
import { ReminderSettingsForm } from "@/features/work-settings/components/reminder-settings-form";
import { ScheduleForm } from "@/features/work-settings/components/schedule-form";
import { ScheduleHistory } from "@/features/work-settings/components/schedule-history";
import { ScheduleSummary } from "@/features/work-settings/components/schedule-summary";
import { getWorkSettings, listSchedules } from "@/features/work-settings/queries";
import { can, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Attendance settings" };

export default async function AttendanceSettingsPage() {
  const user = await requireUser();
  if (!can(user, "policy:manage")) return <NoAccess title="Attendance settings" />;
  const [settings, schedules] = await Promise.all([getWorkSettings(), listSchedules()]);
  // Newest first, so the first upcoming one is the latest planned version
  const upcoming = schedules.find((schedule) => schedule.state === "upcoming") ?? null;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Attendance settings</h1>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Schedule in force</CardTitle>
            <CardDescription>What today&apos;s check-ins are measured against.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {settings.currentSchedule ? (
              <ScheduleSummary schedule={settings.currentSchedule} />
            ) : (
              <EmptyState
                title="No schedule yet"
                description="Nobody can check in until a schedule takes effect. Schedule one below."
              />
            )}
            {upcoming && <ScheduleSummary schedule={upcoming} />}
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Organization</CardTitle>
              <CardDescription>Apply immediately.</CardDescription>
            </CardHeader>
            <CardContent>
              <OrganizationSettingsForm settings={settings} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Reminders</CardTitle>
              <CardDescription>
                Emails to employees, at most one of each a day. Changes apply within 5 minutes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReminderSettingsForm settings={settings} />
            </CardContent>
          </Card>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Schedule a change</CardTitle>
          <CardDescription>
            Changes start on a future date as a new version. They never apply to days that have
            already started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleForm settings={settings} upcoming={upcoming} />
        </CardContent>
      </Card>
      {schedules.length > 0 && (
        <section aria-labelledby="schedule-history" className="grid gap-2">
          <h2 id="schedule-history" className="text-lg font-semibold tracking-tight">
            Version history
          </h2>
          <ScheduleHistory schedules={schedules} />
        </section>
      )}
    </>
  );
}
