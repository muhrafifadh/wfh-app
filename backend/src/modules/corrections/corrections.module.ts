import { Module } from "@nestjs/common";

import { AttendanceModule } from "@/modules/attendance/attendance.module.js";
import { CorrectionsController } from "@/modules/corrections/corrections.controller.js";
import { CorrectionsRepository } from "@/modules/corrections/corrections.repository.js";
import { CorrectionsService } from "@/modules/corrections/corrections.service.js";

@Module({
  imports: [AttendanceModule],
  controllers: [CorrectionsController],
  providers: [CorrectionsService, CorrectionsRepository],
  exports: [CorrectionsService],
})
export class CorrectionsModule {}
