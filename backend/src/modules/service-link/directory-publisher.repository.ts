import { Injectable } from "@nestjs/common";

import { PrismaService } from "@/infra/employee-db/prisma.service.js";

const divisionSnapshot = {
  id: true,
  organizationId: true,
  code: true,
  name: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

const employeeSnapshot = {
  id: true,
  organizationId: true,
  userId: true,
  divisionId: true,
  managerId: true,
  employeeNumber: true,
  fullName: true,
  status: true,
  employmentStartDate: true,
  employmentEndDate: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} as const;

@Injectable()
export class DirectoryPublisherRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOrganization(id: string) {
    return this.prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
  }

  findDivision(id: string) {
    return this.prisma.division.findUnique({ where: { id }, select: divisionSnapshot });
  }

  findEmployee(id: string) {
    return this.prisma.employee.findUnique({ where: { id }, select: employeeSnapshot });
  }

  allOrganizations() {
    return this.prisma.organization.findMany({ select: { id: true, name: true } });
  }

  allDivisions() {
    return this.prisma.division.findMany({ select: divisionSnapshot });
  }

  allEmployees() {
    return this.prisma.employee.findMany({ select: employeeSnapshot });
  }
}
