import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { AppConfig } from "@/config/config.module.js";
import { PrismaClient } from "@/generated/attendance-db/client.js";
import type { DatabaseHealth } from "@/infra/health/database-health.js";
import { pgAdapter } from "@/infra/pg-adapter.js";

/** The attendance service's own database. No other service connects to it. */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, DatabaseHealth
{
  constructor(config: AppConfig) {
    super({ adapter: pgAdapter(config.get("ATTENDANCE_DATABASE_URL")) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
