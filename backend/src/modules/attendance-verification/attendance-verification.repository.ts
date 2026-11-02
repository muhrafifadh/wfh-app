import { Injectable } from "@nestjs/common";

import { pageWindow } from "@/common/dto/pagination.js";
import { toDateColumn, type LocalDate } from "@/common/time/zoned-time.js";
import { Prisma, type VerificationMethod } from "@/generated/prisma/client.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { Tx } from "@/infra/prisma/prisma.types.js";

const employeeSummary = { select: { id: true, employeeNumber: true, fullName: true } };

const verificationRow = {
  id: true,
  attendanceId: true,
  employeeId: true,
  workDate: true,
  method: true,
  result: true,
  accuracyMeters: true,
  distanceBand: true,
  photoKey: true,
  pendingPhotoKey: true,
  pendingPhotoContentType: true,
  pendingPhotoSize: true,
  reviewedAt: true,
  employee: employeeSummary,
} satisfies Prisma.AttendanceVerificationSelect;

export type VerificationRow = Prisma.AttendanceVerificationGetPayload<{
  select: typeof verificationRow;
}>;

const workLocationRow = {
  id: true,
  employeeId: true,
  label: true,
  latitude: true,
  longitude: true,
  radiusMeters: true,
  status: true,
  createdAt: true,
  employee: employeeSummary,
} satisfies Prisma.WorkLocationSelect;

export type WorkLocationRow = Prisma.WorkLocationGetPayload<{ select: typeof workLocationRow }>;

const photoRequestRow = {
  id: true,
  employeeId: true,
  verificationId: true,
  workDate: true,
  status: true,
  createdAt: true,
  employee: employeeSummary,
  verification: { select: { photoKey: true } },
} satisfies Prisma.VerificationPhotoRequestSelect;

export type PhotoRequestRow = Prisma.VerificationPhotoRequestGetPayload<{
  select: typeof photoRequestRow;
}>;

@Injectable()
export class AttendanceVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Settings

  settingsOf(organizationId: string, tx: Tx = this.prisma) {
    return tx.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { locationVerificationEnabled: true, selfieVerificationEnabled: true },
    });
  }

  updateSettings(
    organizationId: string,
    data: { locationVerificationEnabled: boolean; selfieVerificationEnabled: boolean },
    tx: Tx = this.prisma,
  ) {
    return tx.organization.update({
      where: { id: organizationId },
      data,
      select: { locationVerificationEnabled: true, selfieVerificationEnabled: true },
    });
  }

  // Notice

  async hasAcknowledged(employeeId: string, noticeVersion: number, tx: Tx = this.prisma) {
    const row = await tx.verificationNoticeAcknowledgement.findUnique({
      where: { employeeId_noticeVersion: { employeeId, noticeVersion } },
      select: { id: true },
    });
    return row !== null;
  }

  async acknowledge(
    data: {
      organizationId: string;
      employeeId: string;
      noticeVersion: number;
      acknowledgedAt: Date;
    },
    tx: Tx = this.prisma,
  ): Promise<void> {
    await tx.verificationNoticeAcknowledgement.createMany({ data: [data], skipDuplicates: true });
  }

  // Verification results

  /** One row per method for a check-in; an existing row is left alone. */
  async createResults(
    rows: Prisma.AttendanceVerificationCreateManyInput[],
    tx: Tx = this.prisma,
  ): Promise<void> {
    await tx.attendanceVerification.createMany({ data: rows, skipDuplicates: true });
  }

  findForAttendance(attendanceId: string, tx: Tx = this.prisma): Promise<VerificationRow[]> {
    return tx.attendanceVerification.findMany({
      where: { attendanceId },
      select: verificationRow,
    });
  }

  findResult(attendanceId: string, method: VerificationMethod, tx: Tx = this.prisma) {
    return tx.attendanceVerification.findUnique({
      where: { attendanceId_method: { attendanceId, method } },
      select: verificationRow,
    });
  }

  findInOrganization(organizationId: string, id: string, tx: Tx = this.prisma) {
    return tx.attendanceVerification.findFirst({
      where: { id, organizationId },
      select: verificationRow,
    });
  }

  updateResult(
    id: string,
    data: Prisma.AttendanceVerificationUncheckedUpdateInput,
    tx: Tx = this.prisma,
  ): Promise<VerificationRow> {
    return tx.attendanceVerification.update({ where: { id }, data, select: verificationRow });
  }

  async list(
    organizationId: string,
    query: {
      page: number;
      pageSize: number;
      from?: LocalDate;
      to?: LocalDate;
      flagged?: boolean;
      employeeIds?: string[];
    },
    tx: Tx = this.prisma,
  ): Promise<{ rows: VerificationRow[]; total: number }> {
    const where: Prisma.AttendanceVerificationWhereInput = {
      organizationId,
      ...(query.employeeIds && { employeeId: { in: query.employeeIds } }),
      ...((query.from || query.to) && {
        workDate: {
          ...(query.from && { gte: toDateColumn(query.from) }),
          ...(query.to && { lte: toDateColumn(query.to) }),
        },
      }),
      ...(query.flagged && { result: "outside_approved_area", reviewedAt: null }),
    };
    const [rows, total] = await Promise.all([
      tx.attendanceVerification.findMany({
        where,
        select: verificationRow,
        orderBy: [{ workDate: "desc" }, { id: "desc" }],
        ...pageWindow(query),
      }),
      tx.attendanceVerification.count({ where }),
    ]);
    return { rows, total };
  }

  /** The employee's own results, newest first; requests are for their photo access. */
  listOwn(organizationId: string, employeeId: string, take: number, tx: Tx = this.prisma) {
    return tx.attendanceVerification.findMany({
      where: { organizationId, employeeId },
      select: {
        id: true,
        workDate: true,
        method: true,
        result: true,
        photoKey: true,
        photoRequests: {
          select: { status: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [{ workDate: "desc" }, { id: "desc" }],
      take,
    });
  }

  // Work locations

  findWorkLocations(employeeId: string, tx: Tx = this.prisma): Promise<WorkLocationRow[]> {
    return tx.workLocation.findMany({
      where: { employeeId, status: { in: ["pending", "approved"] } },
      select: workLocationRow,
    });
  }

  /** A new request replaces an undecided one, and an approved area stays active meanwhile. */
  async requestWorkLocation(
    data: Prisma.WorkLocationUncheckedCreateInput,
    tx: Tx,
  ): Promise<WorkLocationRow> {
    await tx.workLocation.deleteMany({
      where: { employeeId: data.employeeId, status: "pending" },
    });
    return tx.workLocation.create({ data, select: workLocationRow });
  }

  listPendingWorkLocations(organizationId: string, tx: Tx = this.prisma) {
    return tx.workLocation.findMany({
      where: { organizationId, status: "pending" },
      select: workLocationRow,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  findWorkLocation(organizationId: string, id: string, tx: Tx = this.prisma) {
    return tx.workLocation.findFirst({
      where: { id, organizationId },
      select: workLocationRow,
    });
  }

  /** Compare-and-set: false if it was no longer pending. */
  async decideWorkLocation(
    id: string,
    data: { status: "approved" | "rejected"; decidedAt: Date; radiusMeters?: number },
    tx: Tx = this.prisma,
  ): Promise<boolean> {
    const { count } = await tx.workLocation.updateMany({
      where: { id, status: "pending" },
      data,
    });
    return count === 1;
  }

  async supersedeApproved(employeeId: string, decidedAt: Date, tx: Tx): Promise<void> {
    await tx.workLocation.updateMany({
      where: { employeeId, status: "approved" },
      data: { status: "superseded", decidedAt },
    });
  }

  // Photo requests

  findOpenPhotoRequest(verificationId: string, tx: Tx = this.prisma) {
    return tx.verificationPhotoRequest.findFirst({
      where: { verificationId, status: "open" },
      select: photoRequestRow,
    });
  }

  createPhotoRequest(
    data: Prisma.VerificationPhotoRequestUncheckedCreateInput,
    tx: Tx = this.prisma,
  ): Promise<PhotoRequestRow> {
    return tx.verificationPhotoRequest.create({ data, select: photoRequestRow });
  }

  listOpenPhotoRequests(organizationId: string, tx: Tx = this.prisma) {
    return tx.verificationPhotoRequest.findMany({
      where: { organizationId, status: "open" },
      select: photoRequestRow,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  findPhotoRequest(organizationId: string, id: string, tx: Tx = this.prisma) {
    return tx.verificationPhotoRequest.findFirst({
      where: { id, organizationId },
      select: photoRequestRow,
    });
  }

  /** Compare-and-set: false if it was no longer open. */
  async decidePhotoRequest(
    id: string,
    data: { status: "disclosed" | "declined"; decidedAt: Date; identityCheck?: string },
    tx: Tx = this.prisma,
  ): Promise<boolean> {
    const { count } = await tx.verificationPhotoRequest.updateMany({
      where: { id, status: "open" },
      data,
    });
    return count === 1;
  }

  // Cleanup

  findExpiredPhotos(now: Date, take: number, tx: Tx = this.prisma) {
    return tx.attendanceVerification.findMany({
      where: { photoDeleteAfter: { lt: now } },
      select: { id: true, photoKey: true },
      orderBy: { id: "asc" },
      take,
    });
  }

  async clearPhoto(id: string, tx: Tx = this.prisma): Promise<void> {
    await tx.attendanceVerification.update({
      where: { id },
      data: { photoKey: null, photoDeleteAfter: null },
    });
  }

  findExpiredPendingPhotos(now: Date, take: number, tx: Tx = this.prisma) {
    return tx.attendanceVerification.findMany({
      where: { pendingPhotoExpiresAt: { lt: now } },
      select: { id: true, pendingPhotoKey: true },
      orderBy: { id: "asc" },
      take,
    });
  }

  /** Results past retention whose photo, if any, is already gone. */
  async deleteExpiredResults(now: Date, tx: Tx = this.prisma): Promise<number> {
    const { count } = await tx.attendanceVerification.deleteMany({
      where: { deleteAfter: { lt: now }, photoKey: null, pendingPhotoKey: null },
    });
    return count;
  }

  async deleteClosedWorkLocations(before: Date, tx: Tx = this.prisma): Promise<number> {
    const { count } = await tx.workLocation.deleteMany({
      where: { status: { in: ["rejected", "superseded"] }, decidedAt: { lt: before } },
    });
    return count;
  }

  /** People who have left: their home area has no further use. */
  async deleteWorkLocationsOfInactive(tx: Tx = this.prisma): Promise<number> {
    const { count } = await tx.workLocation.deleteMany({
      where: { employee: { status: "inactive" } },
    });
    return count;
  }

  async deleteClosedPhotoRequests(before: Date, tx: Tx = this.prisma): Promise<number> {
    const { count } = await tx.verificationPhotoRequest.deleteMany({
      where: { status: { not: "open" }, decidedAt: { lt: before } },
    });
    return count;
  }
}
