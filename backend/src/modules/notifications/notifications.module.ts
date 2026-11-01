import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AttendanceModule } from "@/modules/attendance/attendance.module.js";
import { CorrectionsModule } from "@/modules/corrections/corrections.module.js";
import { EmployeesModule } from "@/modules/employees/employees.module.js";
import { HolidaysModule } from "@/modules/holidays/holidays.module.js";
import { NotificationEmailsProcessor } from "@/modules/notifications/jobs/notification-emails.processor.js";
import { NOTIFICATION_EMAILS_QUEUE } from "@/modules/notifications/jobs/notification-emails.queue.js";
import { NotificationJobsProcessor } from "@/modules/notifications/jobs/notification-jobs.processor.js";
import { NOTIFICATION_JOBS_QUEUE } from "@/modules/notifications/jobs/notification-jobs.queue.js";
import { NotificationsController } from "@/modules/notifications/notifications.controller.js";
import { NotificationsListener } from "@/modules/notifications/notifications.listener.js";
import { NotificationsRepository } from "@/modules/notifications/notifications.repository.js";
import { NotificationsService } from "@/modules/notifications/notifications.service.js";
import { UsersModule } from "@/modules/users/users.module.js";
import { WorkSettingsModule } from "@/modules/work-settings/work-settings.module.js";

/** DOMAIN_RULES.md §18 — notifications: created from events and schedules, emailed, listed. */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: NOTIFICATION_EMAILS_QUEUE },
      { name: NOTIFICATION_JOBS_QUEUE },
    ),
    AttendanceModule,
    CorrectionsModule,
    EmployeesModule,
    HolidaysModule,
    UsersModule,
    WorkSettingsModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsListener,
    NotificationEmailsProcessor,
    NotificationJobsProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
