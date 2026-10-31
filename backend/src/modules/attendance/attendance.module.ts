import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AttendanceController } from "@/modules/attendance/attendance.controller.js";
import { AttendanceRepository } from "@/modules/attendance/attendance.repository.js";
import { AttendanceService } from "@/modules/attendance/attendance.service.js";
import { CloseDayService } from "@/modules/attendance/close-day.service.js";
import { IdempotencyRepository } from "@/modules/attendance/idempotency.repository.js";
import { AttendanceJobsProcessor } from "@/modules/attendance/jobs/attendance-jobs.processor.js";
import { ATTENDANCE_JOBS_QUEUE } from "@/modules/attendance/jobs/attendance-jobs.queue.js";
import { EmployeesModule } from "@/modules/employees/employees.module.js";
import { HolidaysModule } from "@/modules/holidays/holidays.module.js";
import { WorkSettingsModule } from "@/modules/work-settings/work-settings.module.js";

@Module({
  imports: [
    BullModule.registerQueue({ name: ATTENDANCE_JOBS_QUEUE }),
    EmployeesModule,
    WorkSettingsModule,
    HolidaysModule,
  ],
  controllers: [AttendanceController],
  providers: [
    AttendanceService,
    CloseDayService,
    AttendanceRepository,
    IdempotencyRepository,
    AttendanceJobsProcessor,
  ],
  exports: [AttendanceService],
})
export class AttendanceModule {}
