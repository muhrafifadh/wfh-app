import { Module } from "@nestjs/common";

import { DivisionsModule } from "@/modules/divisions/divisions.module.js";
import { EmployeesController } from "@/modules/employees/employees.controller.js";
import { EmployeesRepository } from "@/modules/employees/employees.repository.js";
import { EmployeesService } from "@/modules/employees/employees.service.js";
import { MeController } from "@/modules/employees/me.controller.js";
import { UsersModule } from "@/modules/users/users.module.js";
import { WorkSettingsModule } from "@/modules/work-settings/work-settings.module.js";

@Module({
  imports: [UsersModule, DivisionsModule, WorkSettingsModule],
  controllers: [EmployeesController, MeController],
  providers: [EmployeesService, EmployeesRepository],
  exports: [EmployeesService],
})
export class EmployeesModule {}
