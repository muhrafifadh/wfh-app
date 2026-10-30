import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import type { Paginated } from "@/common/dto/pagination.js";
import { NotFoundError } from "@/common/errors/app-error.js";
import type { AuthUser } from "@/common/types/auth.js";
import {
  DivisionCodeTakenError,
  DivisionInactiveError,
  DivisionNameTakenError,
} from "@/modules/divisions/divisions.errors.js";
import { DIVISION_EVENTS, DivisionEvent } from "@/modules/divisions/divisions.events.js";
import {
  DivisionsRepository,
  DUPLICATE,
  type DivisionRow,
} from "@/modules/divisions/divisions.repository.js";
import type { CreateDivisionInput } from "@/modules/divisions/dto/create-division.dto.js";
import type { DivisionResponseBody } from "@/modules/divisions/dto/division.response.js";
import type { ListDivisionsQueryInput } from "@/modules/divisions/dto/list-divisions.query.js";
import type { UpdateDivisionInput } from "@/modules/divisions/dto/update-division.dto.js";

const toDivision = (row: DivisionRow): DivisionResponseBody => ({
  id: row.id,
  code: row.code,
  name: row.name,
  status: row.status,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

@Injectable()
export class DivisionsService {
  constructor(
    private readonly repo: DivisionsRepository,
    private readonly events: EventEmitter2,
  ) {}

  async list(
    user: AuthUser,
    query: ListDivisionsQueryInput,
  ): Promise<Paginated<DivisionResponseBody>> {
    const { rows, total } = await this.repo.list(user.organizationId, query);
    return { items: rows.map(toDivision), page: query.page, pageSize: query.pageSize, total };
  }

  async findOne(user: AuthUser, id: string): Promise<DivisionResponseBody> {
    return toDivision(await this.load(user.organizationId, id));
  }

  async create(user: AuthUser, input: CreateDivisionInput): Promise<DivisionResponseBody> {
    await this.assertUnique(user.organizationId, input);
    const created = await this.repo.insert({ ...input, organizationId: user.organizationId });
    // Lost a race with an identical create: report the clash the check would have found
    if (created === DUPLICATE) return this.throwClash(user.organizationId, input);

    await this.emit(DIVISION_EVENTS.created, user, created.id, { code: created.code });
    return toDivision(created);
  }

  async update(
    user: AuthUser,
    id: string,
    input: UpdateDivisionInput,
  ): Promise<DivisionResponseBody> {
    const target = await this.load(user.organizationId, id);
    await this.assertUnique(user.organizationId, input, id);
    const updated = await this.repo.update(id, input);
    if (updated === DUPLICATE) return this.throwClash(user.organizationId, input, id);

    await this.emit(DIVISION_EVENTS.updated, user, id, {
      fields: Object.keys(input),
      ...(input.code !== undefined &&
        input.code !== target.code && {
          codeFrom: target.code,
          codeTo: updated.code,
        }),
    });
    return toDivision(updated);
  }

  /**
   * Stops new employees from being assigned to it. Employees already in it stay,
   * with their history. Safe to repeat.
   */
  async deactivate(user: AuthUser, id: string): Promise<DivisionResponseBody> {
    return this.setStatus(user, id, "inactive");
  }

  async reactivate(user: AuthUser, id: string): Promise<DivisionResponseBody> {
    return this.setStatus(user, id, "active");
  }

  // Used by employees

  /** The division if it's in the organization and open for new assignments. */
  async assertAssignable(organizationId: string, id: string): Promise<DivisionRow> {
    const division = await this.load(organizationId, id);
    if (division.status !== "active") throw new DivisionInactiveError();
    return division;
  }

  // Helpers

  /** 404 for a division in another organization (docs/09-authorization.md). */
  private async load(organizationId: string, id: string): Promise<DivisionRow> {
    const division = await this.repo.findInOrganization(organizationId, id);
    if (!division) throw new NotFoundError("Division");
    return division;
  }

  private async setStatus(
    user: AuthUser,
    id: string,
    status: DivisionRow["status"],
  ): Promise<DivisionResponseBody> {
    const target = await this.load(user.organizationId, id);
    if (target.status === status) return toDivision(target);

    const updated = await this.repo.setStatus(id, status);
    await this.emit(
      status === "active" ? DIVISION_EVENTS.reactivated : DIVISION_EVENTS.deactivated,
      user,
      id,
    );
    return toDivision(updated);
  }

  private async assertUnique(
    organizationId: string,
    values: { code?: string; name?: string },
    exceptId?: string,
  ): Promise<void> {
    const clash = await this.repo.findClash(organizationId, values, exceptId);
    if (!clash) return;
    if (values.code !== undefined && clash.code === values.code) throw new DivisionCodeTakenError();
    throw new DivisionNameTakenError();
  }

  private async throwClash(
    organizationId: string,
    values: { code?: string; name?: string },
    exceptId?: string,
  ): Promise<never> {
    await this.assertUnique(organizationId, values, exceptId);
    // The other row is gone again; still a conflict from the caller's point of view
    throw new DivisionCodeTakenError();
  }

  private async emit(
    name: (typeof DIVISION_EVENTS)[keyof typeof DIVISION_EVENTS],
    actor: AuthUser,
    targetId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.events.emitAsync(
      name,
      new DivisionEvent(name, actor.organizationId, actor.id, targetId, metadata),
    );
  }
}
