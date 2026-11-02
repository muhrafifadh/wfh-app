import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { PinoLogger } from "nestjs-pino";

import { AttendanceVerificationService } from "@/modules/attendance-verification/attendance-verification.service.js";
import { ATTENDANCE_EVENTS, type AttendanceEvent } from "@/modules/attendance/attendance.events.js";

/**
 * Check-in commits first, and this runs after. A failure here is logged and never fails
 * the check-in (decision V4, docs/15-background-jobs.md#in-process-events).
 */
@Injectable()
export class AttendanceVerificationListener {
  constructor(
    private readonly verification: AttendanceVerificationService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AttendanceVerificationListener.name);
  }

  @OnEvent(ATTENDANCE_EVENTS.checkedIn)
  async onCheckedIn(event: AttendanceEvent): Promise<void> {
    try {
      await this.verification.recordCheckIn(event.organizationId, event.targetId);
    } catch (error) {
      this.logger.error(
        { err: error, attendanceId: event.targetId },
        "Creating verification results failed",
      );
    }
  }
}
