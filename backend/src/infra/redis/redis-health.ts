import { Injectable, type OnModuleDestroy } from "@nestjs/common";

import { Redis } from "ioredis";

import { AppConfig } from "@/config/config.module.js";

/** A small connection used only by the readiness check (docs/12-logging-and-observability.md). */
@Injectable()
export class RedisHealth implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(config: AppConfig) {
    this.client = new Redis(config.get("REDIS_URL"), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  async ping(): Promise<void> {
    if (this.client.status === "wait") await this.client.connect();
    await this.client.ping();
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit().catch(() => undefined);
  }
}
