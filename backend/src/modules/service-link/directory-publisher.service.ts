import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import type { Queue } from "bullmq";
import { PinoLogger } from "nestjs-pino";

import {
  DIRECTORY_SYNC_JOB_OPTIONS,
  DIRECTORY_SYNC_QUEUE,
  ORGANIZATION_CREATED_EVENT,
  type DirectorySyncJobName,
  type DivisionSnapshot,
  type EmployeeSnapshot,
  type OrganizationSnapshot,
} from "@/common/contracts/service-events.js";
import type { AuditableEvent } from "@/common/events/auditable-event.js";
import { DirectoryPublisherRepository } from "@/modules/service-link/directory-publisher.repository.js";

type DirectoryJob = OrganizationSnapshot | DivisionSnapshot | EmployeeSnapshot;

/** Dates and nullable dates as ISO strings: what a queue message can carry. */
const isoDates = <T extends Record<string, unknown>>(row: T) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date ? value.toISOString() : value,
    ]),
  ) as unknown as DirectoryJob;

/**
 * Tells the attendance service about every change to organizations, divisions and
 * employees. It sends the full row, read fresh, so a lost or repeated message can't
 * leave a wrong field behind; `resync` repairs anything a crash did lose.
 */
@Injectable()
export class DirectoryPublisherService {
  constructor(
    private readonly repo: DirectoryPublisherRepository,
    private readonly logger: PinoLogger,
    @InjectQueue(DIRECTORY_SYNC_QUEUE) private readonly queue: Queue<DirectoryJob>,
  ) {
    this.logger.setContext(DirectoryPublisherService.name);
  }

  @OnEvent(ORGANIZATION_CREATED_EVENT)
  async onOrganizationCreated(organizationId: string): Promise<void> {
    await this.publish("organization", () => this.repo.findOrganization(organizationId));
  }

  @OnEvent("division.*")
  async onDivisionEvent(event: AuditableEvent): Promise<void> {
    const { targetId } = event;
    if (targetId) await this.publish("division", () => this.repo.findDivision(targetId));
  }

  @OnEvent("employee.*")
  async onEmployeeEvent(event: AuditableEvent): Promise<void> {
    const { targetId } = event;
    if (targetId) await this.publish("employee", () => this.repo.findEmployee(targetId));
  }

  /** Sends everything again: the first fill of a new database, or a repair. */
  async resync(): Promise<{ organizations: number; divisions: number; employees: number }> {
    const [organizations, divisions, employees] = await Promise.all([
      this.repo.allOrganizations(),
      this.repo.allDivisions(),
      this.repo.allEmployees(),
    ]);
    const send = (name: DirectorySyncJobName, rows: Record<string, unknown>[]) =>
      this.queue.addBulk(
        rows.map((row) => ({ name, data: isoDates(row), opts: DIRECTORY_SYNC_JOB_OPTIONS })),
      );
    await send("organization", organizations);
    await send("division", divisions);
    await send("employee", employees);
    return {
      organizations: organizations.length,
      divisions: divisions.length,
      employees: employees.length,
    };
  }

  /** Logged, never thrown: the change is committed, and a resync can still deliver it. */
  private async publish(
    name: DirectorySyncJobName,
    load: () => Promise<Record<string, unknown> | null>,
  ): Promise<void> {
    try {
      const row = await load();
      if (row) await this.queue.add(name, isoDates(row), DIRECTORY_SYNC_JOB_OPTIONS);
    } catch (error) {
      this.logger.error({ err: error, jobName: name }, "Publishing a directory change failed");
    }
  }
}
