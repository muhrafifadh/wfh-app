import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { UploadsCleanupProcessor } from "@/modules/uploads/jobs/uploads-cleanup.processor.js";
import { UPLOADS_CLEANUP_QUEUE } from "@/modules/uploads/jobs/uploads-cleanup.queue.js";
import { UploadsController } from "@/modules/uploads/uploads.controller.js";
import { UploadsRepository } from "@/modules/uploads/uploads.repository.js";
import { UploadsService } from "@/modules/uploads/uploads.service.js";

@Module({
  imports: [BullModule.registerQueue({ name: UPLOADS_CLEANUP_QUEUE })],
  controllers: [UploadsController],
  providers: [UploadsService, UploadsRepository, UploadsCleanupProcessor],
  exports: [UploadsService],
})
export class UploadsModule {}
