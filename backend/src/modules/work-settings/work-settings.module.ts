import { Module } from "@nestjs/common";

import { WorkSchedulesController } from "@/modules/work-settings/work-schedules.controller.js";
import { WorkSettingsController } from "@/modules/work-settings/work-settings.controller.js";
import { WorkSettingsRepository } from "@/modules/work-settings/work-settings.repository.js";
import { WorkSettingsService } from "@/modules/work-settings/work-settings.service.js";

@Module({
  controllers: [WorkSettingsController, WorkSchedulesController],
  providers: [WorkSettingsService, WorkSettingsRepository],
  exports: [WorkSettingsService],
})
export class WorkSettingsModule {}
