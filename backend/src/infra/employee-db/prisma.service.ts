import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { PrismaPg } from "@prisma/adapter-pg";

import { AppConfig } from "@/config/config.module.js";
import { PrismaClient } from "@/generated/employee-db/client.js";
import type { DatabaseHealth } from "@/infra/health/database-health.js";

/** The employee service's own database. No other service connects to it. */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy, DatabaseHealth
{
  constructor(config: AppConfig) {
    super({
      adapter: new PrismaPg({ connectionString: config.get("EMPLOYEE_DATABASE_URL") }),
    });
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
