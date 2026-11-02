import { Global, Module } from "@nestjs/common";

import { PrismaService } from "@/infra/attendance-db/prisma.service.js";
import { DatabaseHealth } from "@/infra/health/database-health.js";

@Global()
@Module({
  providers: [PrismaService, { provide: DatabaseHealth, useExisting: PrismaService }],
  exports: [PrismaService, DatabaseHealth],
})
export class AttendanceDbModule {}
