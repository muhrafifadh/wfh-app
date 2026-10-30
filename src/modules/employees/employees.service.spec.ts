import type { EventEmitter2 } from "@nestjs/event-emitter";

import { mock } from "vitest-mock-extended";

import { NotFoundError } from "@/common/errors/app-error.js";
import type { AuthUser } from "@/common/types/auth.js";
import type { PrismaService } from "@/infra/prisma/prisma.service.js";
import type { DivisionsService } from "@/modules/divisions/divisions.service.js";
import {
  EmployeeHasAccountError,
  EmploymentPeriodInvalidError,
  ManagerInactiveError,
  ReportingLineCycleError,
  UserHasEmployeeError,
} from "@/modules/employees/employees.errors.js";
import type { EmployeeRow, EmployeesRepository } from "@/modules/employees/employees.repository.js";
import { EmployeesService } from "@/modules/employees/employees.service.js";
import type { UsersService } from "@/modules/users/users.service.js";
import type { WorkSettingsService } from "@/modules/work-settings/work-settings.service.js";

const ORG = "01a00000-0000-7000-8000-000000000001";
const ME = "01a00000-0000-7000-8000-000000000002";
const EMPLOYEE = "01a00000-0000-7000-8000-000000000003";
const MANAGER = "01a00000-0000-7000-8000-000000000004";
const DIVISION = "01a00000-0000-7000-8000-000000000005";
const USER = "01a00000-0000-7000-8000-000000000006";

const caller: AuthUser = {
  id: ME,
  sessionId: "s",
  organizationId: ORG,
  permissions: ["employee:manage", "user:manage"],
};

const anEmployee = (overrides: Partial<EmployeeRow> = {}): EmployeeRow => ({
  id: EMPLOYEE,
  organizationId: ORG,
  userId: null,
  divisionId: DIVISION,
  managerId: null,
  employeeNumber: "EMP-001",
  fullName: "Rina Wijaya",
  workEmail: null,
  jobTitle: null,
  status: "active",
  employmentStartDate: new Date("2026-01-05T00:00:00Z"),
  employmentEndDate: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  division: { id: DIVISION, code: "ENG", name: "Engineering" },
  manager: null,
  user: null,
  ...overrides,
});

describe("EmployeesService", () => {
  const repo = mock<EmployeesRepository>();
  const prisma = mock<PrismaService>();
  const users = mock<UsersService>();
  let service: EmployeesService;

  beforeEach(() => {
    vi.resetAllMocks();
    // Runs the callback with the mock as the transaction client
    prisma.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(prisma)) as never);
    service = new EmployeesService(
      repo,
      prisma,
      mock<DivisionsService>(),
      users,
      mock<WorkSettingsService>(),
      mock<EventEmitter2>(),
    );
  });

  describe("update: manager", () => {
    beforeEach(() => {
      repo.findInOrganization.mockImplementation(async (_org, id) =>
        id === EMPLOYEE ? anEmployee() : id === MANAGER ? anEmployee({ id: MANAGER }) : null,
      );
      repo.update.mockResolvedValue(anEmployee({ managerId: MANAGER }));
    });

    it("locks reporting lines and checks for a cycle before saving", async () => {
      repo.isInReportingLine.mockResolvedValue(false);
      await service.update(caller, EMPLOYEE, { managerId: MANAGER });
      expect(repo.lockReportingLines.mock.calls).toEqual([[ORG, prisma]]);
      expect(repo.isInReportingLine.mock.calls).toEqual([[ORG, MANAGER, EMPLOYEE, prisma]]);
      expect(repo.update.mock.calls).toEqual([[EMPLOYEE, { managerId: MANAGER }, prisma]]);
    });

    it("rejects a cycle and saves nothing", async () => {
      repo.isInReportingLine.mockResolvedValue(true);
      await expect(service.update(caller, EMPLOYEE, { managerId: MANAGER })).rejects.toBeInstanceOf(
        ReportingLineCycleError,
      );
      expect(repo.update.mock.calls).toHaveLength(0);
    });

    it("rejects an inactive or unknown manager", async () => {
      repo.findInOrganization.mockImplementation(async (_org, id) =>
        id === EMPLOYEE ? anEmployee() : anEmployee({ id: MANAGER, status: "inactive" }),
      );
      await expect(service.update(caller, EMPLOYEE, { managerId: MANAGER })).rejects.toBeInstanceOf(
        ManagerInactiveError,
      );

      repo.findInOrganization.mockImplementation(async (_org, id) =>
        id === EMPLOYEE ? anEmployee() : null,
      );
      await expect(service.update(caller, EMPLOYEE, { managerId: MANAGER })).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("skips the cycle check when removing the manager", async () => {
      repo.findInOrganization.mockResolvedValue(anEmployee({ managerId: MANAGER }));
      await service.update(caller, EMPLOYEE, { managerId: null });
      expect(repo.isInReportingLine.mock.calls).toHaveLength(0);
    });
  });

  it("checks a new end date against the stored start date", async () => {
    repo.findInOrganization.mockResolvedValue(anEmployee());
    await expect(
      service.update(caller, EMPLOYEE, { employmentEndDate: "2026-01-04" }),
    ).rejects.toBeInstanceOf(EmploymentPeriodInvalidError);
    expect(repo.update.mock.calls).toHaveLength(0);
  });

  describe("linkAccount", () => {
    it("refuses an employee that already has an account", async () => {
      repo.findInOrganization.mockResolvedValue(anEmployee({ userId: USER }));
      await expect(
        service.linkAccount(caller, EMPLOYEE, {
          mode: "invite",
          email: "x@example.test",
          roleId: ME,
        }),
      ).rejects.toBeInstanceOf(EmployeeHasAccountError);
      expect(users.invite.mock.calls).toHaveLength(0);
    });

    it("refuses a user that belongs to another employee", async () => {
      repo.findInOrganization.mockResolvedValue(anEmployee());
      users.findOne.mockResolvedValue({ id: USER, role: { id: ME, name: "employee" } } as never);
      repo.findByUser.mockResolvedValue(anEmployee({ id: MANAGER, userId: USER }));
      await expect(
        service.linkAccount(caller, EMPLOYEE, { mode: "link", userId: USER }),
      ).rejects.toBeInstanceOf(UserHasEmployeeError);
      expect(repo.linkUser.mock.calls).toHaveLength(0);
    });
  });
});
