import { Module } from "@nestjs/common";

import { EmployeesModule } from "@/modules/employees/employees.module.js";
import { HolidaysModule } from "@/modules/holidays/holidays.module.js";
import {
  DashboardController,
  ReportsController,
  TeamController,
} from "@/modules/reports/reports.controller.js";
import { ReportsRepository } from "@/modules/reports/reports.repository.js";
import { ReportsService } from "@/modules/reports/reports.service.js";
import { WorkSettingsModule } from "@/modules/work-settings/work-settings.module.js";

@Module({
  imports: [EmployeesModule, HolidaysModule, WorkSettingsModule],
  controllers: [TeamController, DashboardController, ReportsController],
  providers: [ReportsService, ReportsRepository],
})
export class ReportsModule {}
