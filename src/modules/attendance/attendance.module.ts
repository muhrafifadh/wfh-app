import { Module } from "@nestjs/common";

import { AttendanceController } from "@/modules/attendance/attendance.controller.js";
import { AttendanceRepository } from "@/modules/attendance/attendance.repository.js";
import { AttendanceService } from "@/modules/attendance/attendance.service.js";
import { IdempotencyRepository } from "@/modules/attendance/idempotency.repository.js";
import { EmployeesModule } from "@/modules/employees/employees.module.js";
import { HolidaysModule } from "@/modules/holidays/holidays.module.js";
import { WorkSettingsModule } from "@/modules/work-settings/work-settings.module.js";

@Module({
  imports: [EmployeesModule, WorkSettingsModule, HolidaysModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceRepository, IdempotencyRepository],
  exports: [AttendanceService],
})
export class AttendanceModule {}
