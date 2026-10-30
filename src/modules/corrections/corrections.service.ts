import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import type { Paginated } from "@/common/dto/pagination.js";
import { ForbiddenError, NotFoundError } from "@/common/errors/app-error.js";
import { fromDateColumn, toDateColumn } from "@/common/time/zoned-time.js";
import type { AuthUser } from "@/common/types/auth.js";
import { Clock } from "@/infra/clock/clock.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import {
  ATTENDANCE_SNAPSHOT_VERSION,
  AttendanceService,
} from "@/modules/attendance/attendance.service.js";
import type { CorrectionChange } from "@/modules/corrections/corrections.constants.js";
import {
  CorrectionAlreadyDecidedError,
  CorrectionAlreadyPendingError,
  CorrectionSelfApprovalForbiddenError,
  CorrectionTimesInvalidError,
  CorrectionVersionConflictError,
  CorrectionWindowClosedError,
} from "@/modules/corrections/corrections.errors.js";
import {
  CORRECTION_EVENTS,
  CorrectionEvent,
  type CorrectionEventName,
} from "@/modules/corrections/corrections.events.js";
import {
  ALREADY_PENDING,
  CorrectionsRepository,
  type CorrectionFilter,
  type CorrectionRow,
} from "@/modules/corrections/corrections.repository.js";
import {
  canSubmitAt,
  proposalErrors,
  resultingPair,
  submissionClosesAt,
} from "@/modules/corrections/domain/correction-policy.js";
import type { CorrectionResponseBody } from "@/modules/corrections/dto/correction.response.js";
import type {
  ApproveCorrectionInput,
  RejectCorrectionInput,
} from "@/modules/corrections/dto/decide-correction.dto.js";
import type {
  ListCorrectionsQueryInput,
  ListMyCorrectionsQueryInput,
} from "@/modules/corrections/dto/list-corrections.query.js";
import type { SubmitCorrectionInput } from "@/modules/corrections/dto/submit-correction.dto.js";
import { EmployeeProfileRequiredError } from "@/modules/employees/employees.errors.js";
import { EmployeesService } from "@/modules/employees/employees.service.js";
import { UsersService } from "@/modules/users/users.service.js";

/**
 * Who the caller may decide for (§11.4): the whole organization (correction:decide_all),
 * their active direct reports (correction:decide_team), or nobody. Never themselves.
 */
type ReviewScope = { kind: "all" } | { kind: "team"; employeeIds: Set<string> } | { kind: "none" };

const inScope = (scope: ReviewScope, employeeId: string): boolean =>
  scope.kind === "all" || (scope.kind === "team" && scope.employeeIds.has(employeeId));

const sameInstant = (a: Date | null, b: Date | null) => a?.getTime() === b?.getTime();

const changesOf = (row: CorrectionRow): CorrectionChange[] => [
  ...(sameInstant(row.requestedCheckInAt, row.currentCheckInAt) ? [] : ["check_in" as const]),
  ...(sameInstant(row.requestedCheckOutAt, row.currentCheckOutAt) ? [] : ["check_out" as const]),
];

@Injectable()
export class CorrectionsService {
  constructor(
    private readonly repo: CorrectionsRepository,
    private readonly prisma: PrismaService,
    private readonly attendance: AttendanceService,
    private readonly employees: EmployeesService,
    private readonly users: UsersService,
    private readonly clock: Clock,
    private readonly events: EventEmitter2,
  ) {}

  // Submitting (§11.1–11.4)

  async submit(user: AuthUser, input: SubmitCorrectionInput): Promise<CorrectionResponseBody> {
    const employee = await this.employees.findProfileForUser(user.organizationId, user.id);
    if (!employee) throw new EmployeeProfileRequiredError();
    const now = this.clock.now();

    // Only your own records; anyone else's is "not found"
    const record = await this.attendance.findForCorrection(user.organizationId, input.attendanceId);
    if (!record || record.employeeId !== employee.id) throw new NotFoundError("Attendance record");

    if (!canSubmitAt(now, record.workDate, record.timezone)) {
      throw new CorrectionWindowClosedError(submissionClosesAt(record.workDate, record.timezone));
    }
    if (record.pendingCorrectionId) throw new CorrectionAlreadyPendingError();

    const proposal = {
      ...(input.requestedCheckInAt && { checkInAt: new Date(input.requestedCheckInAt) }),
      ...(input.requestedCheckOutAt && { checkOutAt: new Date(input.requestedCheckOutAt) }),
    };
    const errors = proposalErrors(record, proposal, {
      workDate: record.workDate,
      timeZone: record.timezone,
      now,
    });
    if (Object.keys(errors).length > 0) throw new CorrectionTimesInvalidError(errors);
    const pair = resultingPair(record, proposal);

    const row = await this.repo.insert({
      organizationId: user.organizationId,
      attendanceId: record.id,
      employeeId: employee.id,
      workDate: toDateColumn(record.workDate),
      currentCheckInAt: record.checkInAt,
      currentCheckOutAt: record.checkOutAt,
      requestedCheckInAt: pair.checkInAt as Date, // proposalErrors guarantees a check-in
      requestedCheckOutAt: pair.checkOutAt,
      reason: input.reason,
      requestedById: user.id,
      expectedAttendanceVersion: record.version,
      submittedAt: now,
    });
    // A parallel submission for the same record got there first
    if (row === ALREADY_PENDING) throw new CorrectionAlreadyPendingError();

    await this.emit(CORRECTION_EVENTS.submitted, user, row, { changes: changesOf(row) });
    return (await this.toResponses(user, [row], { kind: "none" }))[0] as CorrectionResponseBody;
  }

  // Reading

  async listMine(
    user: AuthUser,
    query: ListMyCorrectionsQueryInput,
  ): Promise<Paginated<CorrectionResponseBody>> {
    const { rows, total } = await this.repo.list(
      { organizationId: user.organizationId, requestedById: user.id, status: query.status },
      query,
      "desc",
    );
    return {
      items: await this.toResponses(user, rows, { kind: "none" }),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /** Requests the caller may decide, never their own. Pending ones come oldest first. */
  async listForReview(
    user: AuthUser,
    query: ListCorrectionsQueryInput,
  ): Promise<Paginated<CorrectionResponseBody>> {
    const scope = await this.reviewScope(user);
    if (scope.kind === "none") throw new ForbiddenError();
    const filter: CorrectionFilter = {
      organizationId: user.organizationId,
      status: query.status,
      excludeRequestedById: user.id,
      employeeId: query.employeeId,
      ...(scope.kind === "team" && { employeeIds: [...scope.employeeIds] }),
    };
    const { rows, total } = await this.repo.list(
      filter,
      query,
      query.status === "pending" ? "asc" : "desc",
    );
    return {
      items: await this.toResponses(user, rows, scope),
      page: query.page,
      pageSize: query.pageSize,
      total,
    };
  }

  /** Visible to the requester and to reviewers in scope; 404 for anyone else. */
  async findOne(user: AuthUser, id: string): Promise<CorrectionResponseBody> {
    const { row, scope } = await this.loadVisible(user, id);
    return (await this.toResponses(user, [row], scope))[0] as CorrectionResponseBody;
  }

  // Deciding (§11.4–11.5)

  async approve(
    user: AuthUser,
    id: string,
    input: ApproveCorrectionInput,
  ): Promise<CorrectionResponseBody> {
    return this.decide(user, id, "approved", input.decisionNote ?? null);
  }

  async reject(
    user: AuthUser,
    id: string,
    input: RejectCorrectionInput,
  ): Promise<CorrectionResponseBody> {
    return this.decide(user, id, "rejected", input.decisionNote);
  }

  private async decide(
    user: AuthUser,
    id: string,
    status: "approved" | "rejected",
    decisionNote: string | null,
  ): Promise<CorrectionResponseBody> {
    // Visible means own or in scope, so past the self check the caller may decide it
    const { row, scope } = await this.loadVisible(user, id);
    if (row.requestedById === user.id) throw new CorrectionSelfApprovalForbiddenError();
    if (row.status !== "pending") throw new CorrectionAlreadyDecidedError();
    const now = this.clock.now();

    const { decided, outcome } = await this.prisma.$transaction(async (tx) => {
      const decided = await this.repo.decide(
        id,
        { status, decidedById: user.id, decidedAt: now, decisionNote },
        tx,
      );
      if (!decided) throw new CorrectionAlreadyDecidedError();
      if (status === "rejected") return { decided, outcome: null };

      const outcome = await this.attendance.applyCorrection(
        user.organizationId,
        row.attendanceId,
        row.expectedAttendanceVersion,
        { checkInAt: row.requestedCheckInAt, checkOutAt: row.requestedCheckOutAt },
        now,
        tx,
      );
      // Rolls back the decision too: the request stays pending for a rejection
      if (!outcome) throw new CorrectionVersionConflictError();
      await this.repo.insertSnapshot(
        {
          correctionRequestId: id,
          before: outcome.before,
          after: outcome.after,
          schemaVersion: ATTENDANCE_SNAPSHOT_VERSION,
        },
        tx,
      );
      return { decided, outcome };
    });

    await this.emit(
      status === "approved" ? CORRECTION_EVENTS.approved : CORRECTION_EVENTS.rejected,
      user,
      decided,
      {
        changes: changesOf(decided),
        ...(outcome && {
          statusFrom: outcome.before.status,
          statusTo: outcome.after.status,
          completionFrom: outcome.before.completion,
          completionTo: outcome.after.completion,
        }),
      },
    );
    return (await this.toResponses(user, [decided], scope))[0] as CorrectionResponseBody;
  }

  // Helpers

  private async reviewScope(user: AuthUser): Promise<ReviewScope> {
    if (user.permissions.includes("correction:decide_all")) return { kind: "all" };
    if (!user.permissions.includes("correction:decide_team")) return { kind: "none" };
    const manager = await this.employees.findProfileForUser(user.organizationId, user.id);
    // An inactive manager no longer leads a team
    if (!manager || manager.status !== "active") return { kind: "team", employeeIds: new Set() };
    return {
      kind: "team",
      employeeIds: new Set(await this.employees.activeReportIds(user.organizationId, manager.id)),
    };
  }

  private async loadVisible(
    user: AuthUser,
    id: string,
  ): Promise<{ row: CorrectionRow; scope: ReviewScope }> {
    const [row, scope] = await Promise.all([
      this.repo.findInOrganization(user.organizationId, id),
      this.reviewScope(user),
    ]);
    if (!row || (row.requestedById !== user.id && !inScope(scope, row.employeeId))) {
      throw new NotFoundError("Correction request");
    }
    return { row, scope };
  }

  private async toResponses(
    user: AuthUser,
    rows: CorrectionRow[],
    scope: ReviewScope,
  ): Promise<CorrectionResponseBody[]> {
    const [employees, names] = await Promise.all([
      this.employees.summariesByIds(
        user.organizationId,
        rows.map((row) => row.employeeId),
      ),
      this.users.namesByIds(
        user.organizationId,
        rows.flatMap((row) => [row.requestedById, ...(row.decidedById ? [row.decidedById] : [])]),
      ),
    ]);
    const person = (id: string) => ({ id, name: names.get(id) ?? "" });

    return rows.map((row) => {
      const employee = employees.get(row.employeeId);
      return {
        id: row.id,
        attendanceId: row.attendanceId,
        workDate: fromDateColumn(row.workDate),
        status: row.status,
        employee: {
          id: row.employeeId,
          employeeNumber: employee?.employeeNumber ?? "",
          fullName: employee?.fullName ?? "",
        },
        requestedBy: person(row.requestedById),
        current: {
          checkInAt: row.currentCheckInAt?.toISOString() ?? null,
          checkOutAt: row.currentCheckOutAt?.toISOString() ?? null,
        },
        requested: {
          checkInAt: row.requestedCheckInAt.toISOString(),
          checkOutAt: row.requestedCheckOutAt?.toISOString() ?? null,
        },
        changes: changesOf(row),
        reason: row.reason,
        submittedAt: row.submittedAt.toISOString(),
        decision:
          row.decidedById && row.decidedAt
            ? {
                decidedBy: person(row.decidedById),
                decidedAt: row.decidedAt.toISOString(),
                note: row.decisionNote,
              }
            : null,
        canDecide:
          row.status === "pending" &&
          row.requestedById !== user.id &&
          inScope(scope, row.employeeId),
      };
    });
  }

  private async emit(
    name: CorrectionEventName,
    actor: AuthUser,
    row: CorrectionRow,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.events.emitAsync(
      name,
      new CorrectionEvent(name, actor.organizationId, actor.id, row.id, {
        attendanceId: row.attendanceId,
        employeeId: row.employeeId,
        workDate: fromDateColumn(row.workDate),
        ...metadata,
      }),
    );
  }
}
