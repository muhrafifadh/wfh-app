// Development data. Safe to run repeatedly (upserts). Never runs in production.
// Hadir.in pilot data: DATA_MODEL.md §16 (attendance history comes in a later phase).
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { DEFAULT_ROLES, type DefaultRoleName } from "../src/common/types/auth.js";
import { PrismaClient } from "../src/generated/prisma/client.js";

config({ quiet: true });

const { DATABASE_URL, NODE_ENV, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_DEMO_PASSWORD } =
  process.env;

if (NODE_ENV === "production") throw new Error("Refusing to seed a production database.");
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set.");
if (!SEED_ADMIN_PASSWORD || SEED_ADMIN_PASSWORD.length < 12) {
  throw new Error("Set SEED_ADMIN_PASSWORD (12+ characters) in .env before seeding.");
}
const demoPassword = SEED_DEMO_PASSWORD ?? SEED_ADMIN_PASSWORD;
if (demoPassword.length < 12) throw new Error("SEED_DEMO_PASSWORD needs 12+ characters.");

const email = (SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

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

async function main(): Promise<void> {
  const organization =
    (await prisma.organization.findFirst({ where: { name: "Acme" } })) ??
    (await prisma.organization.create({ data: { name: "Acme" } }));
  await prisma.organization.update({
    where: { id: organization.id },
    data: { timezone: "Asia/Jakarta", supportContact: "hr@example.com" },
  });

  const roles = {} as Record<DefaultRoleName, string>;
  for (const [name, permissions] of Object.entries(DEFAULT_ROLES)) {
    const role = await prisma.role.upsert({
      where: { organizationId_name: { organizationId: organization.id, name } },
      update: { permissions: [...permissions] },
      create: { organizationId: organization.id, name, permissions: [...permissions] },
    });
    roles[name as DefaultRoleName] = role.id;
  }

  // The owner has no employee profile: the "user without a profile" fixture
  const owner = await prisma.user.upsert({
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
    const row = await prisma.division.upsert({
      where: { organizationId_code: { organizationId: organization.id, code: division.code } },
      update: { name: division.name, status: "active" },
      create: { organizationId: organization.id, ...division },
    });
    divisions[division.code] = row.id;
  }

  const demoHash = await hash(demoPassword);
  const employeeIds = new Map<string, string>();
  // Managers come first in the list, so their ids exist when their reports are seeded
  for (const seed of EMPLOYEES) {
    const userId = seed.account
      ? (
          await prisma.user.upsert({
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
    const employee = await prisma.employee.upsert({
      where: {
        organizationId_employeeNumber: {
          organizationId: organization.id,
          employeeNumber: seed.number,
        },
      },
      update: data,
      create: { organizationId: organization.id, employeeNumber: seed.number, ...data },
    });
    employeeIds.set(seed.number, employee.id);
  }

  await prisma.workSchedule.upsert({
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
        data: { organizationId: organization.id, date, name: holiday.name, createdById: owner.id },
      });
    }
  }

  console.warn(
    `Seeded organization "Acme": owner ${email}, ${DIVISIONS.length} divisions, ` +
      `${EMPLOYEES.length} employees, the baseline schedule and ${HOLIDAYS.length} holidays ` +
      "(demo accounts use SEED_DEMO_PASSWORD).",
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
