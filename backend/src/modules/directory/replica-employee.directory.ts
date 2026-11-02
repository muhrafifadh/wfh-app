import { Injectable } from "@nestjs/common";

import {
  EmployeeDirectory,
  type EmployeeProfile,
  type EmployeeSummary,
} from "@/common/contracts/directory.js";
import { fromDateColumn, toDateColumn } from "@/common/time/zoned-time.js";
import { ReplicaRepository } from "@/modules/directory/replica.repository.js";

/**
 * Answers from this service's own copy of the employees. Reports need that copy anyway,
 * to sort and filter across tables, and attendance doesn't stop if the employee service
 * pauses. The cost: a change takes a moment to arrive (see the split plan, decision 3).
 */
@Injectable()
export class ReplicaEmployeeDirectory extends EmployeeDirectory {
  constructor(private readonly repo: ReplicaRepository) {
    super();
  }

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

  eligibleIdsOn(
    organizationId: string,
    date: string,
    afterId: string | null,
    take: number,
  ): Promise<string[]> {
    return this.repo.eligibleIdsOn(organizationId, toDateColumn(date), afterId, take);
  }

  async teamOf(
    organizationId: string,
    userId: string,
  ): Promise<{ managerId: string; employeeIds: string[] } | null> {
    const manager = await this.repo.findByUser(organizationId, userId);
    if (!manager || manager.status !== "active") return null;
    return {
      managerId: manager.id,
      employeeIds: await this.repo.activeReportIds(organizationId, manager.id),
    };
  }

  async accountsOf(organizationId: string, ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.repo.findAccounts(organizationId, [...new Set(ids)]);
    return new Map(rows.flatMap((row) => (row.userId ? [[row.id, row.userId] as const] : [])));
  }

  async reportingLineOf(
    organizationId: string,
    employeeId: string,
  ): Promise<{ fullName: string; managerUserId: string | null } | null> {
    const row = await this.repo.findNameAndManager(organizationId, employeeId);
    if (!row) return null;
    const manager = row.managerId
      ? await this.repo.findManagerAccount(organizationId, row.managerId)
      : null;
    const activeManager = manager && manager.status === "active" && manager.deletedAt === null;
    return { fullName: row.fullName, managerUserId: activeManager ? manager.userId : null };
  }

  async summariesByIds(
    organizationId: string,
    ids: string[],
  ): Promise<Map<string, EmployeeSummary>> {
    if (ids.length === 0) return new Map();
    const rows = await this.repo.findSummaries(organizationId, [...new Set(ids)]);
    return new Map(rows.map((row) => [row.id, row]));
  }
}
