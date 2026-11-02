import { Module } from "@nestjs/common";

import { MeController } from "@/modules/work-settings/me-context.controller.js";
import { MeContextService } from "@/modules/work-settings/me-context.service.js";
import { WorkSchedulesController } from "@/modules/work-settings/work-schedules.controller.js";
import { WorkSettingsController } from "@/modules/work-settings/work-settings.controller.js";
import { WorkSettingsRepository } from "@/modules/work-settings/work-settings.repository.js";
import { WorkSettingsService } from "@/modules/work-settings/work-settings.service.js";

@Module({
  controllers: [WorkSettingsController, WorkSchedulesController, MeController],
  providers: [WorkSettingsService, WorkSettingsRepository, MeContextService],
  exports: [WorkSettingsService],
})
export class WorkSettingsModule {}
