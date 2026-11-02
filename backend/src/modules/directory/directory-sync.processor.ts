import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";

import type { Job } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import {
  DIRECTORY_SYNC_QUEUE,
  divisionSnapshotSchema,
  employeeSnapshotSchema,
  organizationSnapshotSchema,
  type DirectorySyncJobName,
} from "@/common/contracts/service-events.js";
import { logJobFailure } from "@/infra/queue/job-failure.js";
import { ReplicaRepository } from "@/modules/directory/replica.repository.js";

/**
 * Applies the employee service's changes to this service's copy. A job can fail when its
 * parent row hasn't arrived yet; the retry finds it there. Safe to run twice or out of order.
 */
@Processor(DIRECTORY_SYNC_QUEUE)
export class DirectorySyncProcessor extends WorkerHost {
  constructor(
    private readonly repo: ReplicaRepository,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(DirectorySyncProcessor.name);
  }

  async process(job: Job<unknown, void, DirectorySyncJobName>): Promise<void> {
    switch (job.name) {
      case "organization":
        await this.repo.applyOrganization(organizationSnapshotSchema.parse(job.data));
        break;
      case "division":
        await this.repo.applyDivision(divisionSnapshotSchema.parse(job.data));
        break;
      case "employee":
        await this.repo.applyEmployee(employeeSnapshotSchema.parse(job.data));
        break;
      default:
        throw new Error(`Unknown job name: ${String(job.name)}`);
    }
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job | undefined, error: Error): void {
    logJobFailure(this.logger, job, error);
  }
}
