import { Injectable } from "@nestjs/common";

import { pageWindow, type PaginationQuery } from "@/common/dto/pagination.js";
import { Prisma, type CorrectionStatus } from "@/generated/attendance-db/client.js";
import { PrismaService } from "@/infra/attendance-db/prisma.service.js";
import type { Tx } from "@/infra/attendance-db/prisma.types.js";

const correctionRow = {
  id: true,
  organizationId: true,
  attendanceId: true,
  employeeId: true,
  workDate: true,
  status: true,
  currentCheckInAt: true,
  currentCheckOutAt: true,
  requestedCheckInAt: true,
  requestedCheckOutAt: true,
  reason: true,
  requestedById: true,
  expectedAttendanceVersion: true,
  decidedById: true,
  decisionNote: true,
  submittedAt: true,
  decidedAt: true,
  // The schedule snapshot never changes, so before/after outcomes stay reproducible
  attendance: { select: { onTimeDeadlineAt: true, scheduleTimezone: true } },
} satisfies Prisma.CorrectionRequestSelect;

export type CorrectionRow = Prisma.CorrectionRequestGetPayload<{ select: typeof correctionRow }>;

export type CorrectionInsert = Omit<
  CorrectionRow,
  "id" | "status" | "decidedById" | "decisionNote" | "decidedAt" | "attendance"
>;

export type CorrectionFilter = {
  organizationId: string;
  status?: CorrectionStatus;
  requestedById?: string;
  /** Leave out this requester's own requests (a reviewer's queue). */
  excludeRequestedById?: string;
  employeeId?: string;
  attendanceId?: string;
  divisionId?: string;
  /** Only these employees (a manager's team). */
  employeeIds?: string[];
};

/** The record already has a pending request (the unique pending marker). */
export const ALREADY_PENDING = Symbol("already-pending");

@Injectable()
export class CorrectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findInOrganization(
    organizationId: string,
    id: string,
    tx: Tx = this.prisma,
  ): Promise<CorrectionRow | null> {
    return tx.correctionRequest.findFirst({ where: { id, organizationId }, select: correctionRow });
  }

  async list(
    filter: CorrectionFilter,
    query: PaginationQuery,
    order: "asc" | "desc",
    tx: Tx = this.prisma,
  ): Promise<{ rows: CorrectionRow[]; total: number }> {
    const where: Prisma.CorrectionRequestWhereInput = {
      organizationId: filter.organizationId,
      ...(filter.status && { status: filter.status }),
      ...(filter.requestedById && { requestedById: filter.requestedById }),
      ...(filter.attendanceId && { attendanceId: filter.attendanceId }),
      ...(filter.divisionId && { employee: { divisionId: filter.divisionId } }),
      ...(filter.excludeRequestedById && { requestedById: { not: filter.excludeRequestedById } }),
      ...(filter.employeeIds && { employeeId: { in: filter.employeeIds } }),
      // An explicit employee narrows the scope above, it never widens it
      ...(filter.employeeId && {
        AND: [{ employeeId: filter.employeeId }],
      }),
    };
    const [rows, total] = await Promise.all([
      tx.correctionRequest.findMany({
        where,
        select: correctionRow,
        orderBy: [{ submittedAt: order }, { id: order }],
        ...pageWindow(query),
      }),
      tx.correctionRequest.count({ where }),
    ]);
    return { rows, total };
  }

  async insert(
    data: CorrectionInsert,
    tx: Tx = this.prisma,
  ): Promise<CorrectionRow | typeof ALREADY_PENDING> {
    try {
      return await tx.correctionRequest.create({
        data: { ...data, status: "pending", pendingAttendanceId: data.attendanceId },
        select: correctionRow,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return ALREADY_PENDING;
      }
      throw error;
    }
  }

  /**
   * §11.5 (1) — first decision wins: changes the request only while it's still
   * pending. A concurrent decision waits for the row lock, then matches nothing.
   */
  async decide(
    id: string,
    data: {
      status: "approved" | "rejected";
      decidedById: string;
      decidedAt: Date;
      decisionNote: string | null;
    },
    tx: Tx = this.prisma,
  ): Promise<CorrectionRow | null> {
    const { count } = await tx.correctionRequest.updateMany({
      where: { id, status: "pending" },
      data: { ...data, pendingAttendanceId: null },
    });
    return count === 1
      ? tx.correctionRequest.findUniqueOrThrow({ where: { id }, select: correctionRow })
      : null;
  }

  async insertSnapshot(
    data: {
      correctionRequestId: string;
      before: Prisma.InputJsonValue;
      after: Prisma.InputJsonValue;
      schemaVersion: number;
    },
    tx: Tx = this.prisma,
  ): Promise<void> {
    await tx.correctionSnapshot.create({ data });
  }
}
