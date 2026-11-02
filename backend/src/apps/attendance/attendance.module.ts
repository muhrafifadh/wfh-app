import { Module } from "@nestjs/common";

import { FoundationModule } from "@/apps/foundation.module.js";
import { AttendanceDbModule } from "@/infra/attendance-db/prisma.module.js";
import { AttendanceVerificationModule } from "@/modules/attendance-verification/attendance-verification.module.js";
import { AttendanceModule } from "@/modules/attendance/attendance.module.js";
import { CorrectionsModule } from "@/modules/corrections/corrections.module.js";
import { DirectoryModule } from "@/modules/directory/directory.module.js";
import { HolidaysModule } from "@/modules/holidays/holidays.module.js";
import { NotificationsModule } from "@/modules/notifications/notifications.module.js";
import { ReportsModule } from "@/modules/reports/reports.module.js";
import { WorkSettingsModule } from "@/modules/work-settings/work-settings.module.js";

/** Attendance, photo and location checks, corrections, schedules, reports and notifications. */
@Module({
  imports: [
    FoundationModule,
    AttendanceDbModule,
    DirectoryModule,
    WorkSettingsModule,
    HolidaysModule,
    AttendanceModule,
    AttendanceVerificationModule,
    CorrectionsModule,
    ReportsModule,
    NotificationsModule,
  ],
})
export class AttendanceServiceModule {}
