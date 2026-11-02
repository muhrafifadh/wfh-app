import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AUDIT_EVENTS_QUEUE } from "@/common/contracts/service-events.js";
import { AuditEventsProcessor } from "@/modules/audit/audit-events.processor.js";
import { AuditController } from "@/modules/audit/audit.controller.js";
import { AuditListener } from "@/modules/audit/audit.listener.js";
import { AuditRepository } from "@/modules/audit/audit.repository.js";
import { AuditService } from "@/modules/audit/audit.service.js";

@Module({
  imports: [BullModule.registerQueue({ name: AUDIT_EVENTS_QUEUE })],
  controllers: [AuditController],
  providers: [AuditService, AuditRepository, AuditListener, AuditEventsProcessor],
  exports: [AuditService],
})
export class AuditModule {}
