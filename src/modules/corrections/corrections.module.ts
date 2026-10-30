import { Module } from "@nestjs/common";

import { AttendanceModule } from "@/modules/attendance/attendance.module.js";
import { CorrectionsController } from "@/modules/corrections/corrections.controller.js";
import { CorrectionsRepository } from "@/modules/corrections/corrections.repository.js";
import { CorrectionsService } from "@/modules/corrections/corrections.service.js";
import { EmployeesModule } from "@/modules/employees/employees.module.js";
import { UsersModule } from "@/modules/users/users.module.js";

@Module({
  imports: [AttendanceModule, EmployeesModule, UsersModule],
  controllers: [CorrectionsController],
  providers: [CorrectionsService, CorrectionsRepository],
  exports: [CorrectionsService],
})
export class CorrectionsModule {}
