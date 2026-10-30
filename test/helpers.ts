import { randomUUID } from "node:crypto";

import { getQueueToken } from "@nestjs/bullmq";
import type { Type } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";

import { hash } from "@node-rs/argon2";
import type { Queue } from "bullmq";

import { AppModule } from "@/app.module.js";
import type { Permission } from "@/common/types/auth.js";
import { AppConfig } from "@/config/config.module.js";
import type { Env } from "@/config/env.js";
import { configureApp } from "@/configure-app.js";
import { Clock, FixedClock } from "@/infra/clock/clock.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import { ATTENDANCE_JOBS_QUEUE } from "@/modules/attendance/jobs/attendance-jobs.queue.js";
import { PASSWORD_RESET_QUEUE } from "@/modules/auth/jobs/password-reset.queue.js";
import { UPLOADS_CLEANUP_QUEUE } from "@/modules/uploads/jobs/uploads-cleanup.queue.js";
import { USER_EMAILS_QUEUE } from "@/modules/users/jobs/user-emails.queue.js";

const QUEUES = [
  USER_EMAILS_QUEUE,
  PASSWORD_RESET_QUEUE,
  UPLOADS_CLEANUP_QUEUE,
  ATTENDANCE_JOBS_QUEUE,
];

/** AppConfig with some values replaced, for tests of config-dependent behavior. */
class OverriddenConfig extends AppConfig {
  constructor(
    config: ConfigService<Env, true>,
    private readonly overrides: Partial<Env>,
  ) {
    super(config);
  }

  override get<K extends keyof Env>(key: K): Env[K] {
    return key in this.overrides ? (this.overrides[key] as Env[K]) : super.get(key);
  }
}

/**
 * The real app with the production setup, plus optional test-only controllers.
 * Time is frozen (FixedClock) so no test depends on the host clock; move it with
 * `clockOf(app).set(...)`.
 */
export async function createTestApp(
  controllers: Type[] = [],
  options: { config?: Partial<Env>; now?: string } = {},
): Promise<NestExpressApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule], controllers });
  // Each app gets its own queues: a job left over from one test can never be picked
  // up by the next test's worker (while that test is truncating the database).
  const config: Partial<Env> = { QUEUE_PREFIX: `test-${randomUUID()}`, ...options.config };
  builder.overrideProvider(AppConfig).useFactory({
    factory: (nestConfig: ConfigService<Env, true>) => new OverriddenConfig(nestConfig, config),
    inject: [ConfigService],
  });
  builder.overrideProvider(Clock).useValue(new FixedClock(options.now ?? DEFAULT_NOW));
  const moduleRef = await builder.compile();
  const app = configureApp(
    moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      bufferLogs: true,
    }),
  );
  await app.init();
  return app;
}

/** Monday 2 November 2026, 10:00 in Jakarta (UTC+7). */
export const DEFAULT_NOW = "2026-11-02T03:00:00.000Z";

export const clockOf = (app: NestExpressApplication): FixedClock => app.get(Clock) as FixedClock;

export async function resetDatabase(app: NestExpressApplication): Promise<void> {
  await app.get(PrismaService)
    .$executeRaw`TRUNCATE audit_logs, idempotency_records, attendances, holidays, work_schedules, employees, divisions, uploads, user_tokens, password_reset_tokens, refresh_tokens, sessions, users, roles, organizations RESTART IDENTITY CASCADE`;
}

const queue = (app: NestExpressApplication, name: string): Queue =>
  app.get<Queue>(getQueueToken(name), { strict: false });

/**
 * Waits until every queued job has run, so a test can check its effects (emails
 * sent, rows written). Polls each job's state: QueueEvents can miss a job that
 * finishes before it subscribes. Gives up after 10 s with the job's state.
 */
export async function waitForJobs(app: NestExpressApplication, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (const name of QUEUES) {
    const q = queue(app, name);
    // Skip the next run of scheduled jobs (e.g. the daily uploads cleanup): it's not the test's work
    const jobs = (await q.getJobs(["waiting", "active", "delayed", "prioritized"])).filter(
      (job) => !job.repeatJobKey,
    );
    for (const job of jobs) {
      for (;;) {
        const state = await q.getJobState(job.id ?? "");
        if (state === "completed" || state === "failed" || state === "unknown") break;
        if (Date.now() > deadline) throw new Error(`Job ${name}/${job.id} is still ${state}`);
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
  }
}

export type TestUser = {
  id: string;
  email: string;
  password: string;
  organizationId: string;
  roleId: string;
};

let sequence = 0;

export async function createUser(
  app: NestExpressApplication,
  options: {
    permissions?: Permission[];
    disabled?: boolean;
    /** Join this user's organization (a new role in it) instead of creating one. */
    sameOrganizationAs?: TestUser;
    emailVerified?: boolean;
  } = {},
): Promise<TestUser> {
  const prisma = app.get(PrismaService);
  const n = ++sequence;
  const password = `correct-horse-battery-${n}`;
  const organizationId =
    options.sameOrganizationAs?.organizationId ??
    (await prisma.organization.create({ data: { name: `Org ${n}` } })).id;
  const role = await prisma.role.create({
    data: { organizationId, name: `test-${n}`, permissions: options.permissions ?? [] },
  });
  const user = await prisma.user.create({
    data: {
      email: `user${n}@example.test`,
      name: `User ${n}`,
      organizationId,
      roleId: role.id,
      passwordHash: await hash(password),
      emailVerifiedAt: options.emailVerified === false ? null : new Date(),
      disabledAt: options.disabled ? new Date() : null,
    },
  });
  return { id: user.id, email: user.email, password, organizationId, roleId: role.id };
}

/** A valid Authorization header without going through /auth/login. */
export async function authHeader(
  app: NestExpressApplication,
  user: TestUser,
  options: { expiresIn?: number } = {},
): Promise<{ Authorization: string }> {
  const session = await app.get(PrismaService).session.create({
    data: { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  const token = await app
    .get(JwtService, { strict: false })
    .signAsync({ sid: session.id }, { subject: user.id, ...options });
  return { Authorization: `Bearer ${token}` };
}

let codeSequence = 0;

/** A division in the user's organization (active unless asked otherwise). */
export async function createDivision(
  app: NestExpressApplication,
  owner: Pick<TestUser, "organizationId">,
  options: { inactive?: boolean; name?: string } = {},
): Promise<{ id: string; code: string; name: string }> {
  const n = ++codeSequence;
  return app.get(PrismaService).division.create({
    data: {
      organizationId: owner.organizationId,
      code: `DIV-${n}`,
      name: options.name ?? `Division ${n}`,
      status: options.inactive ? "inactive" : "active",
    },
    select: { id: true, code: true, name: true },
  });
}

/** An employee in the user's organization, in a new division unless one is given. */
export async function createEmployee(
  app: NestExpressApplication,
  owner: Pick<TestUser, "organizationId">,
  options: {
    divisionId?: string;
    managerId?: string;
    userId?: string;
    inactive?: boolean;
  } = {},
): Promise<{ id: string; employeeNumber: string; divisionId: string }> {
  const n = ++codeSequence;
  const divisionId = options.divisionId ?? (await createDivision(app, owner)).id;
  return app.get(PrismaService).employee.create({
    data: {
      organizationId: owner.organizationId,
      employeeNumber: `EMP-${String(n).padStart(3, "0")}`,
      fullName: `Employee ${n}`,
      divisionId,
      managerId: options.managerId ?? null,
      userId: options.userId ?? null,
      status: options.inactive ? "inactive" : "active",
      employmentStartDate: new Date("2026-01-05T00:00:00.000Z"),
    },
    select: { id: true, employeeNumber: true, divisionId: true },
  });
}

/** A schedule version straight in the database: the baseline unless overridden. */
export async function createSchedule(
  app: NestExpressApplication,
  owner: Pick<TestUser, "id" | "organizationId">,
  options: { effectiveFrom?: string; effectiveTo?: string; timezone?: string } = {},
): Promise<{ id: string }> {
  const time = (value: string) => new Date(`1970-01-01T${value}Z`);
  return app.get(PrismaService).workSchedule.create({
    data: {
      organizationId: owner.organizationId,
      createdById: owner.id,
      name: "Default schedule",
      timezone: options.timezone ?? "Asia/Jakarta",
      workingDays: [1, 2, 3, 4, 5],
      startTime: time("09:00:00"),
      endTime: time("17:00:00"),
      toleranceMinutes: 15,
      checkInOpensAt: time("08:00:00"),
      checkInClosesAt: time("17:00:00"),
      checkOutDeadline: time("23:59:59.999"),
      effectiveFrom: new Date(`${options.effectiveFrom ?? "2026-01-05"}T00:00:00.000Z`),
      effectiveTo: options.effectiveTo ? new Date(`${options.effectiveTo}T00:00:00.000Z`) : null,
    },
    select: { id: true },
  });
}
