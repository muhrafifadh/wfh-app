import { Module } from "@nestjs/common";

import { HolidaysController } from "@/modules/holidays/holidays.controller.js";
import { HolidaysRepository } from "@/modules/holidays/holidays.repository.js";
import { HolidaysService } from "@/modules/holidays/holidays.service.js";
import { WorkCalendarController } from "@/modules/holidays/work-calendar.controller.js";
import { WorkSettingsModule } from "@/modules/work-settings/work-settings.module.js";

@Module({
  imports: [WorkSettingsModule],
  controllers: [HolidaysController, WorkCalendarController],
  providers: [HolidaysService, HolidaysRepository],
  exports: [HolidaysService],
})
export class HolidaysModule {}
