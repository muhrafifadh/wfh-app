import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AppConfig } from "@/config/config.module.js";
import { DEFAULT_JOB_OPTIONS } from "@/infra/queue/queue.constants.js";

/**
 * BullMQ on Redis (docs/15-background-jobs.md). Modules register their own queues
 * with BullModule.registerQueue() and keep processors in modules/<m>/jobs/.
 * Workers run in the API process; split them into their own process when needed.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        // Workers block on Redis; BullMQ requires maxRetriesPerRequest: null
        connection: { url: config.get("REDIS_URL"), maxRetriesPerRequest: null },
        prefix: config.get("QUEUE_PREFIX"),
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),
  ],
})
export class QueueModule {}
