import { Module } from "@nestjs/common";

import { DivisionsController } from "@/modules/divisions/divisions.controller.js";
import { DivisionsRepository } from "@/modules/divisions/divisions.repository.js";
import { DivisionsService } from "@/modules/divisions/divisions.service.js";

@Module({
  controllers: [DivisionsController],
  providers: [DivisionsService, DivisionsRepository],
  exports: [DivisionsService],
})
export class DivisionsModule {}
