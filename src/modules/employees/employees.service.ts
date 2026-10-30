import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import type { Paginated } from "@/common/dto/pagination.js";
import { NotFoundError } from "@/common/errors/app-error.js";
import { fromDateColumn, toDateColumn } from "@/common/time/zoned-time.js";
import type { AuthUser } from "@/common/types/auth.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import { DivisionsService } from "@/modules/divisions/divisions.service.js";
import type { CreateEmployeeInput } from "@/modules/employees/dto/create-employee.dto.js";
import type { EmployeeResponseBody } from "@/modules/employees/dto/employee.response.js";
import type { LinkAccountInput } from "@/modules/employees/dto/link-account.dto.js";
import type { ListEmployeesQueryInput } from "@/modules/employees/dto/list-employees.query.js";
import type { UpdateEmployeeInput } from "@/modules/employees/dto/update-employee.dto.js";
import type { EmployeeStatus } from "@/modules/employees/employees.constants.js";
import {
  EmployeeHasAccountError,
  EmployeeNumberTakenError,
  EmployeeProfileRequiredError,
  EmploymentPeriodInvalidError,
  ManagerInactiveError,
  ReportingLineCycleError,
  UserHasEmployeeError,
} from "@/modules/employees/employees.errors.js";
import { EMPLOYEE_EVENTS, EmployeeEvent } from "@/modules/employees/employees.events.js";
import {
  DUPLICATE,
  EmployeesRepository,
  type EmployeeRow,
  type EmployeeWrite,
} from "@/modules/employees/employees.repository.js";
import { userStatusOf } from "@/modules/users/users.constants.js";
import { UsersService } from "@/modules/users/users.service.js";

/** What attendance needs to know about an employee. */
export type EmployeeProfile = {
  id: string;
  employeeNumber: string;
  fullName: string;
  status: EmployeeStatus;
  employmentStartDate: string;
  employmentEndDate: string | null;
};

/** Prisma row → response body (dates become ISO strings, `date` columns YYYY-MM-DD). */
const toEmployee = (row: EmployeeRow): EmployeeResponseBody => ({
  id: row.id,
  employeeNumber: row.employeeNumber,
  fullName: row.fullName,
  workEmail: row.workEmail,
  jobTitle: row.jobTitle,
  status: row.status,
  employmentStartDate: fromDateColumn(row.employmentStartDate),
  employmentEndDate: row.employmentEndDate ? fromDateColumn(row.employmentEndDate) : null,
  division: row.division,
  manager: row.manager,
  account: row.user && {
    id: row.user.id,
    email: row.user.email,
    role: row.user.role,
    status: userStatusOf(row.user),
  },
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

/** API input → column values: dates as `date` columns, unset fields left out. */
const toWrite = (input: UpdateEmployeeInput): EmployeeWrite => {
  const { employmentStartDate, employmentEndDate, ...rest } = input;
  return {
    ...rest,
    ...(employmentStartDate !== undefined && {
      employmentStartDate: toDateColumn(employmentStartDate),
    }),
    ...(employmentEndDate !== undefined && {
      employmentEndDate: employmentEndDate === null ? null : toDateColumn(employmentEndDate),
    }),
  };
};

@Injectable()
export class EmployeesService {
  constructor(
    private readonly repo: EmployeesRepository,
    private readonly prisma: PrismaService,
    private readonly divisions: DivisionsService,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  async list(
    user: AuthUser,
    query: ListEmployeesQueryInput,
  ): Promise<Paginated<EmployeeResponseBody>> {
    const { rows, total } = await this.repo.list(user.organizationId, query);
    return { items: rows.map(toEmployee), page: query.page, pageSize: query.pageSize, total };
  }

  async findOne(user: AuthUser, id: string): Promise<EmployeeResponseBody> {
    return toEmployee(await this.load(user.organizationId, id));
  }

  /** The profile a user records attendance as, or null (for attendance). */
  async findProfileForUser(
    organizationId: string,
    userId: string,
  ): Promise<EmployeeProfile | null> {
    const row = await this.repo.findByUser(organizationId, userId);
    return (
      row && {
        id: row.id,
        employeeNumber: row.employeeNumber,
        fullName: row.fullName,
        status: row.status,
        employmentStartDate: fromDateColumn(row.employmentStartDate),
        employmentEndDate: row.employmentEndDate ? fromDateColumn(row.employmentEndDate) : null,
      }
    );
  }

  /** The caller's own profile (GET /me/employee). */
  async findMine(user: AuthUser): Promise<EmployeeResponseBody> {
    const employee = await this.repo.findByUser(user.organizationId, user.id);
    if (!employee) throw new EmployeeProfileRequiredError();
    return toEmployee(employee);
  }

  /** A new employee has no reports yet, so any active manager is fine (no cycle possible). */
  async create(user: AuthUser, input: CreateEmployeeInput): Promise<EmployeeResponseBody> {
    await this.divisions.assertAssignable(user.organizationId, input.divisionId);
    if (input.managerId) await this.assertManager(user.organizationId, input.managerId);

    const { employeeNumber, ...fields } = input;
    const write = toWrite(fields);
    const created = await this.repo.insert({
      ...write,
      organizationId: user.organizationId,
      employeeNumber,
      fullName: input.fullName,
      divisionId: input.divisionId,
      employmentStartDate: toDateColumn(input.employmentStartDate),
    });
    if (created === DUPLICATE) throw new EmployeeNumberTakenError();

    await this.emit(EMPLOYEE_EVENTS.created, user, created.id, {
      employeeNumber: created.employeeNumber,
      divisionId: created.divisionId,
      managerId: created.managerId,
    });
    return toEmployee(created);
  }

  async update(
    user: AuthUser,
    id: string,
    input: UpdateEmployeeInput,
  ): Promise<EmployeeResponseBody> {
    const target = await this.load(user.organizationId, id);
    const write = toWrite(input);

    const start = write.employmentStartDate ?? target.employmentStartDate;
    const end =
      write.employmentEndDate === undefined ? target.employmentEndDate : write.employmentEndDate;
    if (end && end < start) throw new EmploymentPeriodInvalidError();

    if (input.divisionId !== undefined && input.divisionId !== target.divisionId) {
      await this.divisions.assertAssignable(user.organizationId, input.divisionId);
    }

    const managerChanges = input.managerId !== undefined && input.managerId !== target.managerId;
    const updated = managerChanges
      ? await this.prisma.$transaction(async (tx) => {
          if (input.managerId) {
            await this.assertManager(user.organizationId, input.managerId);
            await this.repo.lockReportingLines(user.organizationId, tx);
            // Includes managerId === id: an employee is in their own reporting line
            if (await this.repo.isInReportingLine(user.organizationId, input.managerId, id, tx)) {
              throw new ReportingLineCycleError();
            }
          }
          return this.repo.update(id, write, tx);
        })
      : await this.repo.update(id, write);

    await this.emit(EMPLOYEE_EVENTS.updated, user, id, { fields: Object.keys(input) });
    if (managerChanges) {
      await this.emit(EMPLOYEE_EVENTS.managerChanged, user, id, {
        managerFrom: target.managerId,
        managerTo: updated.managerId,
      });
    }
    return toEmployee(updated);
  }

  /**
   * Ends attendance eligibility; history stays readable. The linked user can still
   * sign in (deactivate the user for that). Safe to repeat.
   */
  async deactivate(user: AuthUser, id: string): Promise<EmployeeResponseBody> {
    return this.setStatus(user, id, "inactive");
  }

  async reactivate(user: AuthUser, id: string): Promise<EmployeeResponseBody> {
    return this.setStatus(user, id, "active");
  }

  /** Invites a new user for the employee, or links an existing one and optionally sets its role. */
  async linkAccount(
    user: AuthUser,
    id: string,
    input: LinkAccountInput,
  ): Promise<EmployeeResponseBody> {
    const target = await this.load(user.organizationId, id);
    if (target.userId && input.userId !== target.userId) {
      throw new EmployeeHasAccountError();
    }

    // The DTO guarantees email + roleId for "invite" and userId for "link"
    let userId: string;
    if (input.mode === "invite") {
      // The users module checks the role and email and sends the invitation
      const invited = await this.users.invite(user, {
        email: input.email as string,
        name: target.fullName,
        roleId: input.roleId as string,
      });
      userId = invited.id;
    } else {
      const account = await this.users.findOne(user, input.userId as string); // 404 outside the organization
      const owner = await this.repo.findByUser(user.organizationId, account.id);
      if (owner && owner.id !== id) throw new UserHasEmployeeError();
      if (input.roleId && input.roleId !== account.role.id) {
        await this.users.update(user, account.id, { roleId: input.roleId });
      }
      userId = account.id;
      if (target.userId === userId) return toEmployee(await this.load(user.organizationId, id));
    }

    const linked = await this.repo.linkUser(id, userId);
    if (linked === DUPLICATE) throw new UserHasEmployeeError();
    if (!linked) throw new EmployeeHasAccountError();

    await this.emit(EMPLOYEE_EVENTS.accountLinked, user, id, { userId, mode: input.mode });
    return toEmployee(linked);
  }

  // Helpers

  /** 404 for an employee in another organization (docs/09-authorization.md). */
  private async load(organizationId: string, id: string): Promise<EmployeeRow> {
    const employee = await this.repo.findInOrganization(organizationId, id);
    if (!employee) throw new NotFoundError("Employee");
    return employee;
  }

  private async assertManager(organizationId: string, managerId: string): Promise<void> {
    const manager = await this.repo.findInOrganization(organizationId, managerId);
    if (!manager) throw new NotFoundError("Manager");
    if (manager.status !== "active") throw new ManagerInactiveError();
  }

  private async setStatus(
    user: AuthUser,
    id: string,
    status: EmployeeStatus,
  ): Promise<EmployeeResponseBody> {
    const target = await this.load(user.organizationId, id);
    if (target.status === status) return toEmployee(target);

    const updated = await this.repo.setStatus(id, status);
    await this.emit(
      status === "active" ? EMPLOYEE_EVENTS.reactivated : EMPLOYEE_EVENTS.deactivated,
      user,
      id,
    );
    return toEmployee(updated);
  }

  private async emit(
    name: (typeof EMPLOYEE_EVENTS)[keyof typeof EMPLOYEE_EVENTS],
    actor: AuthUser,
    targetId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.events.emitAsync(
      name,
      new EmployeeEvent(name, actor.organizationId, actor.id, targetId, metadata),
    );
  }
}
