import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AttendanceVerificationController } from "@/modules/attendance-verification/attendance-verification.controller.js";
import { AttendanceVerificationRepository } from "@/modules/attendance-verification/attendance-verification.repository.js";
import { AttendanceVerificationService } from "@/modules/attendance-verification/attendance-verification.service.js";
import { VerificationCleanupProcessor } from "@/modules/attendance-verification/jobs/verification-cleanup.processor.js";
import { VERIFICATION_CLEANUP_QUEUE } from "@/modules/attendance-verification/jobs/verification-cleanup.queue.js";
import { AttendanceModule } from "@/modules/attendance/attendance.module.js";
import { EmployeesModule } from "@/modules/employees/employees.module.js";

@Module({
  imports: [
    BullModule.registerQueue({ name: VERIFICATION_CLEANUP_QUEUE }),
    AttendanceModule,
    EmployeesModule,
  ],
  controllers: [AttendanceVerificationController],
  providers: [
    AttendanceVerificationService,
    AttendanceVerificationRepository,
    VerificationCleanupProcessor,
  ],
})
export class AttendanceVerificationModule {}
