import type { EventEmitter2 } from "@nestjs/event-emitter";

import { mock } from "vitest-mock-extended";

import type { UserDirectory } from "@/common/contracts/directory.js";
import type { AuthUser } from "@/common/types/auth.js";
import type { PrismaService } from "@/infra/attendance-db/prisma.service.js";
import { FixedClock } from "@/infra/clock/clock.js";
import type { CreateWorkScheduleInput } from "@/modules/work-settings/dto/create-work-schedule.dto.js";
import {
  ScheduleEffectiveDateTooEarlyError,
  SchedulePeriodOverlapError,
} from "@/modules/work-settings/work-settings.errors.js";
import {
  DUPLICATE,
  type ScheduleRow,
  type WorkSettingsRepository,
} from "@/modules/work-settings/work-settings.repository.js";
import { WorkSettingsService } from "@/modules/work-settings/work-settings.service.js";

const ORG = "01a00000-0000-7000-8000-000000000001";
const ME = "01a00000-0000-7000-8000-000000000002";
const CURRENT = "01a00000-0000-7000-8000-000000000003";
const PLANNED = "01a00000-0000-7000-8000-000000000004";

const caller: AuthUser = {
  id: ME,
  sessionId: "s",
  organizationId: ORG,
  permissions: ["policy:manage"],
};
const time = (value: string) => new Date(`1970-01-01T${value}Z`);
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

const aRow = (overrides: Partial<ScheduleRow> = {}): ScheduleRow => ({
  id: CURRENT,
  organizationId: ORG,
  name: "Default schedule",
  scope: "organization",
  timezone: "Asia/Jakarta",
  workingDays: [1, 2, 3, 4, 5],
  startTime: time("09:00:00"),
  endTime: time("17:00:00"),
  toleranceMinutes: 15,
  checkInOpensAt: time("08:00:00"),
  checkInClosesAt: time("17:00:00"),
  checkOutDeadline: time("23:59:59.999"),
  effectiveFrom: date("2026-01-05"),
  effectiveTo: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  createdById: ME,
  createdByName: "HR",
  ...overrides,
});

const input: CreateWorkScheduleInput = {
  name: "New",
  timezone: "Asia/Jakarta",
  workingDays: [1, 2, 3, 4, 5],
  startTime: 9 * 3600_000,
  endTime: 17 * 3600_000,
  toleranceMinutes: 15,
  checkInOpensAt: 8 * 3600_000,
  checkInClosesAt: 17 * 3600_000,
  checkOutDeadline: 24 * 3600_000 - 1,
  effectiveFrom: "2026-11-03",
};

describe("WorkSettingsService", () => {
  const users = mock<UserDirectory>();
  const repo = mock<WorkSettingsRepository>();
  const prisma = mock<PrismaService>();
  // Monday 2 November 2026, 10:00 in Jakarta
  const clock = new FixedClock("2026-11-02T03:00:00.000Z");
  let service: WorkSettingsService;

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(((fn: (tx: unknown) => unknown) => fn(prisma)) as never);
    repo.findSettings.mockResolvedValue({
      name: "Acme",
      timezone: "Asia/Jakarta",
      supportContact: null,
      retentionYears: 5,
      checkInReminderEnabled: true,
      checkInReminderAt: new Date(9 * 3600_000),
      checkOutReminderEnabled: true,
      checkOutReminderAt: new Date(18 * 3600_000),
    });
    users.namesByIds.mockResolvedValue(new Map([[ME, "HR"]]));
    service = new WorkSettingsService(repo, prisma, clock, mock<EventEmitter2>(), users);
  });

  describe("today", () => {
    it("falls back to the organization zone without a schedule", async () => {
      repo.findInForce.mockResolvedValue([]);
      await expect(service.today(ORG, new Date("2026-11-01T17:30:00Z"))).resolves.toEqual({
        workDate: "2026-11-02",
        timezone: "Asia/Jakarta",
        schedule: null,
      });
    });

    it("picks the newest version that covers its own local date", async () => {
      repo.findInForce.mockResolvedValue([
        aRow({ id: PLANNED, timezone: "Asia/Makassar", effectiveFrom: date("2026-11-03") }),
        aRow({ effectiveTo: date("2026-11-02") }),
      ]);
      // 23:30 on the 2nd in Jakarta, 00:30 on the 3rd in Makassar
      const today = await service.today(ORG, new Date("2026-11-02T16:30:00Z"));
      expect([today.workDate, today.schedule?.id]).toEqual(["2026-11-03", PLANNED]);
    });
  });

  describe("createSchedule", () => {
    beforeEach(() => {
      repo.insertSchedule.mockResolvedValue(
        aRow({ id: PLANNED, effectiveFrom: date("2026-11-03") }),
      );
    });

    it("closes the open version the day before, under the lock", async () => {
      repo.findInForce.mockResolvedValue([aRow()]);
      await service.createSchedule(caller, input);
      expect(repo.lockSchedules.mock.calls).toEqual([[ORG, prisma]]);
      expect(repo.closeSchedule.mock.calls).toEqual([[CURRENT, "2026-11-02", prisma]]);
    });

    it("rejects today as the effective date", async () => {
      repo.findInForce.mockResolvedValue([aRow()]);
      await expect(
        service.createSchedule(caller, { ...input, effectiveFrom: "2026-11-02" }),
      ).rejects.toBeInstanceOf(ScheduleEffectiveDateTooEarlyError);
      expect(repo.insertSchedule.mock.calls).toHaveLength(0);
    });

    it("rejects a date on or before a planned version, changing nothing", async () => {
      repo.findInForce.mockResolvedValue([
        aRow({ id: PLANNED, effectiveFrom: date("2026-11-10") }),
        aRow({ effectiveTo: date("2026-11-09") }),
      ]);
      await expect(service.createSchedule(caller, input)).rejects.toBeInstanceOf(
        SchedulePeriodOverlapError,
      );
      expect(repo.closeSchedule.mock.calls).toHaveLength(0);
    });

    it("turns the unique backstop into an overlap error", async () => {
      repo.findInForce.mockResolvedValue([]);
      repo.insertSchedule.mockResolvedValue(DUPLICATE);
      await expect(service.createSchedule(caller, input)).rejects.toBeInstanceOf(
        SchedulePeriodOverlapError,
      );
    });
  });
});
