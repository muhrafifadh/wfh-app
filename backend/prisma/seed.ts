// Development data. Safe to run repeatedly (upserts). Never runs in production.
// Hadir.in pilot data: DATA_MODEL.md §16.
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { addDays, isoWeekday, localDateOf, parseTimeOfDay } from "../src/common/time/zoned-time.js";
import { DEFAULT_ROLES, type DefaultRoleName } from "../src/common/types/auth.js";
import { PrismaClient as AttendanceClient } from "../src/generated/attendance-db/client.js";
import { PrismaClient as EmployeeClient } from "../src/generated/employee-db/client.js";
import {
  statusAtCheckIn,
  valuesFor,
  workedMinutesBetween,
} from "../src/modules/attendance/domain/attendance-calculator.js";
import { boundariesFor } from "../src/modules/work-settings/domain/schedule-policy.js";

config({ quiet: true });

const {
  ATTENDANCE_DATABASE_URL,
  EMPLOYEE_DATABASE_URL,
  NODE_ENV,
  SEED_ADMIN_EMAIL,
  SEED_ADMIN_PASSWORD,
  SEED_DEMO_PASSWORD,
} = process.env;

if (NODE_ENV === "production") throw new Error("Refusing to seed a production database.");
if (!EMPLOYEE_DATABASE_URL || !ATTENDANCE_DATABASE_URL) {
  throw new Error("EMPLOYEE_DATABASE_URL and ATTENDANCE_DATABASE_URL must be set.");
}
if (!SEED_ADMIN_PASSWORD || SEED_ADMIN_PASSWORD.length < 12) {
  throw new Error("Set SEED_ADMIN_PASSWORD (12+ characters) in .env before seeding.");
}
const demoPassword = SEED_DEMO_PASSWORD ?? SEED_ADMIN_PASSWORD;
if (demoPassword.length < 12) throw new Error("SEED_DEMO_PASSWORD needs 12+ characters.");

const email = (SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
// Writes each database directly, and the attendance service's copy of the shared rows with
// it, so the seed works before any service has started.
const employeeDb = new EmployeeClient({
  adapter: new PrismaPg({ connectionString: EMPLOYEE_DATABASE_URL }),
});
const prisma = new AttendanceClient({
  adapter: new PrismaPg({ connectionString: ATTENDANCE_DATABASE_URL }),
});

const PILOT_START = new Date("2026-01-05T00:00:00.000Z");

/** Times of day for `time` columns (Prisma uses 1970-01-01 UTC). */
const time = (value: string) => new Date(`1970-01-01T${value}Z`);

// DOMAIN_RULES.md §6.1 baseline, in force since the pilot employees started
const BASELINE_SCHEDULE = {
  name: "Default schedule",
  timezone: "Asia/Jakarta",
  workingDays: [1, 2, 3, 4, 5],
  startTime: time("09:00:00"),
  endTime: time("17:00:00"),
  toleranceMinutes: 15,
  checkInOpensAt: time("08:00:00"),
  checkInClosesAt: time("17:00:00"),
  checkOutDeadline: time("23:59:59.999"),
};

// A demo holiday inside the pilot window (week of 2 November 2026) and a real one
const HOLIDAYS = [
  { date: "2026-11-04", name: "Company Day (demo)" },
  { date: "2026-12-25", name: "Christmas Day" },
];

const DIVISIONS = [
  { code: "ENG", name: "Engineering" },
  { code: "PPL", name: "People" },
  { code: "FIN", name: "Finance" },
] as const;

type SeedEmployee = {
  number: string;
  fullName: string;
  jobTitle: string;
  division: (typeof DIVISIONS)[number]["code"];
  /** Employee number of the direct manager. */
  manager?: string;
  /** Login email and role; leave out for an employee without an account. */
  account?: { email: string; role: DefaultRoleName };
  inactive?: boolean;
};

// Fictional people. EMP-001 manages the other nine Engineering pilot employees.
const EMPLOYEES: SeedEmployee[] = [
  {
    number: "EMP-001",
    fullName: "Rina Wijaya",
    jobTitle: "Engineering Manager",
    division: "ENG",
    account: { email: "rina.wijaya@example.com", role: "manager" },
  },
  ...[
    ["EMP-002", "Budi Santoso", "Senior Backend Engineer"],
    ["EMP-003", "Sari Lestari", "Frontend Engineer"],
    ["EMP-004", "Agus Pratama", "Backend Engineer"],
    ["EMP-005", "Dewi Anggraini", "QA Engineer"],
    ["EMP-006", "Fajar Nugroho", "DevOps Engineer"],
    ["EMP-007", "Putri Maharani", "Mobile Engineer"],
    ["EMP-008", "Hendra Gunawan", "Data Engineer"],
    ["EMP-009", "Maya Kusuma", "Frontend Engineer"],
    ["EMP-010", "Yoga Saputra", "Junior Backend Engineer"],
  ].map(([number, fullName, jobTitle]) => ({
    number: number as string,
    fullName: fullName as string,
    jobTitle: jobTitle as string,
    division: "ENG" as const,
    manager: "EMP-001",
    account: {
      email: `${(fullName as string).toLowerCase().replace(" ", ".")}@example.com`,
      role: "employee" as const,
    },
  })),
  {
    number: "HR-001",
    fullName: "Indah Permata",
    jobTitle: "HR Generalist",
    division: "PPL",
    account: { email: "indah.permata@example.com", role: "admin_hr" },
  },
  // Negative fixture: inactive, no account
  {
    number: "EMP-099",
    fullName: "Joko Susilo",
    jobTitle: "Former Engineer",
    division: "ENG",
    manager: "EMP-001",
    inactive: true,
  },
];

type DayPlan = { absent: true } | { checkIn: string; checkOut: string | null };

/**
 * Pilot history over the last five working days (index 0 = oldest). Mostly on time
 * and complete, plus late, absent and open/incomplete cases. Times are WIB.
 */
const dayPlan = (employeeIndex: number, day: number): DayPlan => {
  const special: Record<string, DayPlan> = {
    "4:2": { absent: true },
    "8:4": { absent: true },
    "3:3": { checkIn: "08:52:00", checkOut: null }, // forgot to check out (a correction is pending)
    "4:3": { checkIn: "08:47:00", checkOut: null }, // forgot to check out, for the pilot to correct
    "2:1": { checkIn: "09:27:00", checkOut: "17:31:00" },
    "6:3": { checkIn: "09:41:30", checkOut: "18:02:00" },
    "9:0": { checkIn: "09:16:10", checkOut: "17:20:00" },
  };
  const plan = special[`${employeeIndex}:${day}`];
  if (plan) return plan;
  const minutes = (n: number) => String(n).padStart(2, "0");
  const inOffset = (employeeIndex * 7 + day * 11) % 30; // 08:40–09:09
  const outOffset = (employeeIndex * 5 + day * 3) % 40; // 17:00–17:39
  return {
    checkIn: `${inOffset < 20 ? "08" : "09"}:${minutes((40 + inOffset) % 60)}:00`,
    checkOut: `17:${minutes(outOffset)}:00`,
  };
};

/**
 * Corrections on the history above (same `employee:day` keys): one approved by the
 * manager (late → present) and one waiting for a decision (missing check-out).
 */
const CORRECTIONS: Record<
  string,
  { checkIn?: string; checkOut?: string; reason: string; approvedBy?: string }
> = {
  "2:1": {
    checkIn: "09:05:00",
    reason: "VPN was down at 09:05; I was online and in stand-up from then.",
    approvedBy: "EMP-001",
  },
  "3:3": {
    checkOut: "17:10:00",
    reason: "Forgot to check out; last commit and Slack message were at 17:10.",
  },
};

/** The five working days before today in Jakarta (weekdays that aren't seeded holidays). */
const historyDates = (): string[] => {
  const holidays = new Set(HOLIDAYS.map((h) => h.date));
  const dates: string[] = [];
  for (
    let date = addDays(localDateOf(new Date(), "Asia/Jakarta"), -1);
    dates.length < 5;
    date = addDays(date, -1)
  ) {
    if (isoWeekday(date) <= 5 && !holidays.has(date)) dates.unshift(date);
  }
  return dates;
};

const ORGANIZATION_NAME = "Hadir.in";

async function main(): Promise<void> {
  const organization =
    (await employeeDb.organization.findFirst({ where: { name: ORGANIZATION_NAME } })) ??
    (await employeeDb.organization.create({ data: { name: ORGANIZATION_NAME } }));
  const organizationSettings = {
    name: ORGANIZATION_NAME,
    timezone: "Asia/Jakarta",
    supportContact: "hr@example.com",
    // The use case asks for a photo as proof of working from home. Takes effect only with VERIFICATION_ENABLED on.
    selfieVerificationEnabled: true,
  };
  await prisma.organization.upsert({
    where: { id: organization.id },
    update: organizationSettings,
    create: { id: organization.id, ...organizationSettings },
  });

  const roles = {} as Record<DefaultRoleName, string>;
  for (const [name, permissions] of Object.entries(DEFAULT_ROLES)) {
    const role = await employeeDb.role.upsert({
      where: { organizationId_name: { organizationId: organization.id, name } },
      update: { permissions: [...permissions] },
      create: { organizationId: organization.id, name, permissions: [...permissions] },
    });
    roles[name as DefaultRoleName] = role.id;
  }

  // The owner has no employee profile: the "user without a profile" fixture
  const owner = await employeeDb.user.upsert({
    where: { email },
    update: { roleId: roles.owner, disabledAt: null, deletedAt: null },
    create: {
      email,
      name: "Admin",
      organizationId: organization.id,
      roleId: roles.owner,
      passwordHash: await hash(SEED_ADMIN_PASSWORD as string),
      emailVerifiedAt: new Date(),
    },
  });

  const divisions = {} as Record<(typeof DIVISIONS)[number]["code"], string>;
  for (const division of DIVISIONS) {
    const row = await employeeDb.division.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: division.code } },
      update: { name: division.name, status: "active" },
      create: { organizationId: organization.id, ...division },
    });
    await prisma.division.upsert({ where: { id: row.id }, update: row, create: row });
    divisions[division.code] = row.id;
  }

  const demoHash = await hash(demoPassword);
  const employeeIds = new Map<string, string>();
  const userIds = new Map<string, string>();
  // Managers come first in the list, so their ids exist when their reports are seeded
  for (const seed of EMPLOYEES) {
    const userId = seed.account
      ? (
          await employeeDb.user.upsert({
            where: { email: seed.account.email },
            update: { roleId: roles[seed.account.role], disabledAt: null, deletedAt: null },
            create: {
              email: seed.account.email,
              name: seed.fullName,
              organizationId: organization.id,
              roleId: roles[seed.account.role],
              passwordHash: demoHash,
              emailVerifiedAt: new Date(),
            },
          })
        ).id
      : null;
    const data = {
      fullName: seed.fullName,
      jobTitle: seed.jobTitle,
      workEmail: seed.account?.email ?? null,
      divisionId: divisions[seed.division],
      managerId: seed.manager ? (employeeIds.get(seed.manager) ?? null) : null,
      status: seed.inactive ? ("inactive" as const) : ("active" as const),
      employmentStartDate: PILOT_START,
      userId,
    };
    const employee = await employeeDb.employee.upsert({
      where: {
        organizationId_employeeNumber: {
          organizationId: organization.id,
          employeeNumber: seed.number,
        },
      },
      update: data,
      create: { organizationId: organization.id, employeeNumber: seed.number, ...data },
    });
    const { workEmail: _workEmail, jobTitle: _jobTitle, ...copy } = employee;
    await prisma.employee.upsert({ where: { id: copy.id }, update: copy, create: copy });
    employeeIds.set(seed.number, employee.id);
    if (userId) userIds.set(seed.number, userId);
  }

  const schedule = await prisma.workSchedule.upsert({
    where: {
      organizationId_scope_effectiveFrom: {
        organizationId: organization.id,
        scope: "organization",
        effectiveFrom: PILOT_START,
      },
    },
    update: BASELINE_SCHEDULE,
    create: {
      ...BASELINE_SCHEDULE,
      organizationId: organization.id,
      effectiveFrom: PILOT_START,
      createdById: owner.id,
      createdByName: owner.name,
    },
  });

  for (const holiday of HOLIDAYS) {
    const date = new Date(`${holiday.date}T00:00:00.000Z`);
    const existing = await prisma.holiday.findFirst({
      where: { organizationId: organization.id, date, deletedAt: null },
    });
    if (existing) {
      await prisma.holiday.update({ where: { id: existing.id }, data: { name: holiday.name } });
    } else {
      await prisma.holiday.create({
        data: {
          organizationId: organization.id,
          date,
          name: holiday.name,
          createdById: owner.id,
          createdByName: owner.name,
        },
      });
    }
  }

  // Attendance history, relative to today so it stays inside the correction window.
  // Records are keyed by work date: a re-run on another day adds that day's history.
  const policy = {
    timezone: BASELINE_SCHEDULE.timezone,
    workingDays: BASELINE_SCHEDULE.workingDays,
    startTime: parseTimeOfDay("09:00") as number,
    endTime: parseTimeOfDay("17:00") as number,
    toleranceMinutes: BASELINE_SCHEDULE.toleranceMinutes,
    checkInOpensAt: parseTimeOfDay("08:00") as number,
    checkInClosesAt: parseTimeOfDay("17:00") as number,
    checkOutDeadline: parseTimeOfDay("23:59:59.999") as number,
  };
  const dates = historyDates();
  const pilot = EMPLOYEES.filter((e) => e.division === "ENG" && !e.inactive);
  let records = 0;
  let corrections = 0;
  for (const [day, workDate] of dates.entries()) {
    const b = boundariesFor(policy, workDate);
    for (const [index, seed] of pilot.entries()) {
      const employeeId = employeeIds.get(seed.number) as string;
      const plan = dayPlan(index, day);
      const at = (value: string) => new Date(`${workDate}T${value}+07:00`);
      const timing =
        "absent" in plan
          ? {
              status: "absent" as const,
              completion: "not_applicable" as const,
              source: "close_day_job" as const,
              checkInAt: null,
              checkOutAt: null,
              lateMinutes: 0,
              workedMinutes: null,
              closeDayRunId: "cd-seed",
            }
          : {
              ...statusAtCheckIn(at(plan.checkIn), b.onTimeDeadlineAt),
              completion: plan.checkOut ? ("complete" as const) : ("open" as const),
              source: "self_service" as const,
              checkInAt: at(plan.checkIn),
              checkOutAt: plan.checkOut ? at(plan.checkOut) : null,
              workedMinutes: plan.checkOut
                ? workedMinutesBetween(at(plan.checkIn), at(plan.checkOut))
                : null,
              closeDayRunId: null,
            };
      const data = {
        ...timing,
        workScheduleId: schedule.id,
        scheduleTimezone: policy.timezone,
        scheduledStartAt: b.scheduledStartAt,
        scheduledEndAt: b.scheduledEndAt,
        onTimeDeadlineAt: b.onTimeDeadlineAt,
        checkInOpensAt: b.checkInOpensAt,
        checkInClosesAt: b.checkInClosesAt,
        checkOutClosesAt: b.checkOutClosesAt,
      };
      const workDateColumn = new Date(`${workDate}T00:00:00.000Z`);
      const key = {
        organizationId_employeeId_workDate: {
          organizationId: organization.id,
          employeeId,
          workDate: workDateColumn,
        },
      };
      // A record with corrections (seeded or made in the demo) is left as it is
      const existing = await prisma.attendance.findUnique({
        where: key,
        select: { _count: { select: { corrections: true } } },
      });
      records += 1;
      if (existing && existing._count.corrections > 0) continue;
      const row = await prisma.attendance.upsert({
        where: key,
        update: data,
        create: { ...data, organizationId: organization.id, employeeId, workDate: workDateColumn },
      });

      const correction = CORRECTIONS[`${index}:${day}`];
      if (!correction || !row.checkInAt) continue;
      const requested = {
        checkInAt: correction.checkIn ? at(correction.checkIn) : row.checkInAt,
        checkOutAt: correction.checkOut ? at(correction.checkOut) : row.checkOutAt,
      };
      // The next morning, or now if that's still ahead
      const earlier = (a: Date, b: Date) => (a < b ? a : b);
      const submittedAt = earlier(
        new Date(row.checkOutClosesAt.getTime() + 9 * 3600_000),
        new Date(),
      );
      const request = {
        organizationId: organization.id,
        attendanceId: row.id,
        employeeId,
        workDate: workDateColumn,
        currentCheckInAt: row.checkInAt,
        currentCheckOutAt: row.checkOutAt,
        requestedCheckInAt: requested.checkInAt,
        requestedCheckOutAt: requested.checkOutAt,
        reason: correction.reason,
        requestedById: userIds.get(seed.number) as string,
        expectedAttendanceVersion: row.version,
        submittedAt,
      };
      if (!correction.approvedBy) {
        await prisma.correctionRequest.create({
          data: { ...request, status: "pending", pendingAttendanceId: row.id },
        });
      } else {
        // Same steps as an approval (§11.5): recalculate, bump the version, keep both snapshots
        const decidedAt = earlier(new Date(submittedAt.getTime() + 2 * 3600_000), new Date());
        const snapshot = (r: typeof row) => ({
          status: r.status,
          completion: r.completion,
          checkInAt: r.checkInAt?.toISOString() ?? null,
          checkOutAt: r.checkOutAt?.toISOString() ?? null,
          lateMinutes: r.lateMinutes,
          workedMinutes: r.workedMinutes,
          version: r.version,
          correctedAt: r.correctedAt?.toISOString() ?? null,
        });
        const after = await prisma.attendance.update({
          where: { id: row.id },
          data: {
            ...valuesFor(requested.checkInAt, requested.checkOutAt, row.onTimeDeadlineAt),
            ...requested,
            version: { increment: 1 },
            correctedAt: decidedAt,
          },
        });
        await prisma.correctionRequest.create({
          data: {
            ...request,
            status: "approved",
            decidedById: userIds.get(correction.approvedBy) as string,
            decidedAt,
            snapshot: {
              create: { before: snapshot(row), after: snapshot(after), schemaVersion: 1 },
            },
          },
        });
      }
      corrections += 1;
    }
  }

  console.warn(
    `Seeded organization "${ORGANIZATION_NAME}": owner ${email}, ${DIVISIONS.length} divisions, ` +
      `${EMPLOYEES.length} employees, the baseline schedule, ${HOLIDAYS.length} holidays and ` +
      `${records} attendance records for ${dates[0]}…${dates.at(-1)}, ` +
      `${corrections} new corrections ` +
      "(demo accounts use SEED_DEMO_PASSWORD).",
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
  await employeeDb.$disconnect();
}
