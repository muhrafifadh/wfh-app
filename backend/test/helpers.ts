import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { createServer } from "node:net";

import { getQueueToken } from "@nestjs/bullmq";
import type { Type } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test, type TestingModule } from "@nestjs/testing";

import { hash } from "@node-rs/argon2";
import type { Queue } from "bullmq";
import { Test as SupertestTest } from "supertest";

import { AttendanceServiceModule } from "@/apps/attendance/attendance.module.js";
import { connectEmployeeRpc } from "@/apps/employee/connect-rpc.js";
import { EmployeeServiceModule } from "@/apps/employee/employee.module.js";
import { configureGateway } from "@/apps/gateway/configure-gateway.js";
import { GatewayModule } from "@/apps/gateway/gateway.module.js";
import { AUDIT_EVENTS_QUEUE, DIRECTORY_SYNC_QUEUE } from "@/common/contracts/service-events.js";
import type { Permission } from "@/common/types/auth.js";
import { AppConfig } from "@/config/config.module.js";
import type { Env } from "@/config/env.js";
import { configureApp } from "@/configure-app.js";
import { PrismaService as AttendanceDb } from "@/infra/attendance-db/prisma.service.js";
import { Clock, FixedClock } from "@/infra/clock/clock.js";
import { PrismaService as EmployeeDb } from "@/infra/employee-db/prisma.service.js";
import { MailService } from "@/infra/mail/mail.service.js";
import { StorageService } from "@/infra/storage/storage.service.js";
import { VERIFICATION_CLEANUP_QUEUE } from "@/modules/attendance-verification/jobs/verification-cleanup.queue.js";
import { ATTENDANCE_JOBS_QUEUE } from "@/modules/attendance/jobs/attendance-jobs.queue.js";
import { PASSWORD_RESET_QUEUE } from "@/modules/auth/jobs/password-reset.queue.js";
import { NOTIFICATION_EMAILS_QUEUE } from "@/modules/notifications/jobs/notification-emails.queue.js";
import { NOTIFICATION_JOBS_QUEUE } from "@/modules/notifications/jobs/notification-jobs.queue.js";
import { UPLOADS_CLEANUP_QUEUE } from "@/modules/uploads/jobs/uploads-cleanup.queue.js";
import { USER_EMAILS_QUEUE } from "@/modules/users/jobs/user-emails.queue.js";

const QUEUES = [
  DIRECTORY_SYNC_QUEUE,
  AUDIT_EVENTS_QUEUE,
  USER_EMAILS_QUEUE,
  PASSWORD_RESET_QUEUE,
  UPLOADS_CLEANUP_QUEUE,
  ATTENDANCE_JOBS_QUEUE,
  VERIFICATION_CLEANUP_QUEUE,
  NOTIFICATION_EMAILS_QUEUE,
  NOTIFICATION_JOBS_QUEUE,
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

/** Models that live only in the employee service's database. */
const EMPLOYEE_MODELS = new Set([
  "role",
  "user",
  "session",
  "refreshToken",
  "passwordResetToken",
  "userToken",
  "auditLog",
  "upload",
]);
/** Models in both databases: tests write them straight to both, as the sync would. */
const REPLICATED_MODELS = new Set(["employee", "division"]);
const REPLICA_ONLY_MISSING = ["workEmail", "jobTitle"];

/** One view of both databases, so a test can check rows without caring which service owns them. */
export type TestDb = AttendanceDb &
  Pick<
    EmployeeDb,
    | "role"
    | "user"
    | "session"
    | "refreshToken"
    | "passwordResetToken"
    | "userToken"
    | "auditLog"
    | "upload"
  >;

class TestDbMarker {}
/** Pass to `app.get()` for a TestDb. */
export const PrismaService = TestDbMarker as unknown as Type<TestDb>;

type AnyDelegate = Record<string, (args: Record<string, unknown>) => Promise<unknown>>;

const testDb = (employeeDb: EmployeeDb, attendanceDb: AttendanceDb): TestDb => {
  const delegate = (client: unknown, model: string) =>
    (client as Record<string, AnyDelegate>)[model] as AnyDelegate;
  return new Proxy(attendanceDb, {
    get(_target, property: string) {
      if (EMPLOYEE_MODELS.has(property)) return delegate(employeeDb, property);
      if (!REPLICATED_MODELS.has(property)) {
        const value = (attendanceDb as unknown as Record<string, unknown>)[property];
        return typeof value === "function" ? value.bind(attendanceDb) : value;
      }
      const source = delegate(employeeDb, property);
      const replica = delegate(attendanceDb, property);
      return new Proxy(source, {
        get(_source, method: string) {
          if (!/^(update|updateMany)$/.test(method)) {
            return (args: Record<string, unknown>) => (source[method] as Function)(args);
          }
          return async (args: { data: Record<string, unknown> } & Record<string, unknown>) => {
            const result = await (source[method] as Function)(args);
            const data = Object.fromEntries(
              Object.entries(args.data).filter(([key]) => !REPLICA_ONLY_MISSING.includes(key)),
            );
            await (replica[method] as Function)({ where: args.where, data });
            return result;
          };
        },
      });
    },
  }) as unknown as TestDb;
};

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("No port")),
      );
    });
  });

const portOf = (app: NestExpressApplication): number => {
  const address = (app.getHttpServer() as Server).address();
  if (typeof address !== "object" || !address) throw new Error("Not listening");
  return address.port;
};

const stacks = new Set<NestExpressApplication>();

/** The messages between the services settle before a test looks at their effects. */
const CROSS_SERVICE_QUEUES = [DIRECTORY_SYNC_QUEUE, AUDIT_EVENTS_QUEUE];

async function settleCrossServiceQueues(): Promise<void> {
  const deadline = Date.now() + 15_000;
  for (const app of stacks) {
    for (const name of CROSS_SERVICE_QUEUES) {
      const q = queue(app, name);
      for (;;) {
        const counts = await q.getJobCounts("waiting", "active", "delayed", "prioritized");
        if (Object.values(counts).every((count) => count === 0)) break;
        if (Date.now() > deadline) throw new Error(`Queue ${name} didn't settle`);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
  }
}

// Responses used to mean "the audit entry is written". Keep that true for the specs:
// awaiting a request now also waits for the queued messages it caused.
// oxlint-disable-next-line typescript/unbound-method -- called with its own `this` below
const originalThen = SupertestTest.prototype.then as (...args: unknown[]) => Promise<unknown>;
// oxlint-disable-next-line unicorn/no-thenable -- wrapping supertest's own `then`
SupertestTest.prototype.then = function then(
  this: unknown,
  onFulfilled?: (value: unknown) => unknown,
  onRejected?: (reason: unknown) => unknown,
) {
  return (originalThen.call(this) as Promise<unknown>)
    .then(async (response) => {
      await settleCrossServiceQueues();
      return response;
    })
    .then(onFulfilled, onRejected);
} as typeof SupertestTest.prototype.then;

/**
 * The real system with the production setup: the gateway and both services, each its own
 * Nest app on its own port, talking over real HTTP, TCP and queues. Optional test-only
 * controllers go on the employee service, which also answers unknown paths.
 * Time is frozen (FixedClock) so no test depends on the host clock; move it with
 * `clockOf(app).set(...)`.
 *
 * The result looks like one app: `get()` finds a provider in whichever service has it,
 * and `getHttpServer()` is the gateway.
 */
export async function createTestApp(
  controllers: Type[] = [],
  options: { config?: Partial<Env>; now?: string } = {},
): Promise<NestExpressApplication> {
  // Each app gets its own queues: a job left over from one test can never be picked
  // up by the next test's worker (while that test is truncating the database).
  const config: Partial<Env> = {
    QUEUE_PREFIX: `test-${randomUUID()}`,
    EMPLOYEE_RPC_HOST: "127.0.0.1",
    EMPLOYEE_RPC_PORT: await freePort(),
    ...options.config,
  };
  const withConfig = (builder: ReturnType<typeof Test.createTestingModule>) =>
    builder.overrideProvider(AppConfig).useFactory({
      factory: (nestConfig: ConfigService<Env, true>) => new OverriddenConfig(nestConfig, config),
      inject: [ConfigService],
    });
  const createApp = (moduleRef: TestingModule) =>
    moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      bufferLogs: true,
    });

  const clock = new FixedClock(options.now ?? DEFAULT_NOW);
  const employeeRef = await withConfig(
    Test.createTestingModule({ imports: [EmployeeServiceModule], controllers }),
  )
    .overrideProvider(Clock)
    .useValue(clock)
    .compile();
  const employee = configureApp(createApp(employeeRef));
  connectEmployeeRpc(employee);
  await employee.startAllMicroservices();
  await employee.listen(0, "127.0.0.1");

  // One mailbox and one storage client, so a test can read or stub them in one place
  const attendanceRef = await withConfig(
    Test.createTestingModule({ imports: [AttendanceServiceModule] }),
  )
    .overrideProvider(Clock)
    .useValue(clock)
    .overrideProvider(MailService)
    .useValue(employee.get(MailService))
    .overrideProvider(StorageService)
    .useValue(employee.get(StorageService))
    .compile();
  const attendance = configureApp(createApp(attendanceRef));
  await attendance.listen(0, "127.0.0.1");

  config.EMPLOYEE_SERVICE_URL = `http://127.0.0.1:${portOf(employee)}`;
  config.ATTENDANCE_SERVICE_URL = `http://127.0.0.1:${portOf(attendance)}`;
  const gatewayRef = await withConfig(
    Test.createTestingModule({ imports: [GatewayModule] }),
  ).compile();
  const gateway = configureGateway(createApp(gatewayRef));
  await gateway.init();

  const db = testDb(employee.get(EmployeeDb), attendance.get(AttendanceDb));
  const find = <T>(token: Parameters<NestExpressApplication["get"]>[0]): T => {
    if ((token as unknown) === TestDbMarker) return db as T;
    for (const service of [attendance, employee]) {
      try {
        return service.get<T>(token as never, { strict: false });
      } catch {
        // Not in this service
      }
    }
    throw new Error(`Nothing provides ${String(token)}`);
  };
  const stack = new Proxy(gateway, {
    get(target, property: string, receiver: unknown) {
      if (property === "get") return find;
      if (property === "close") {
        return async () => {
          stacks.delete(stack);
          await gateway.close();
          await attendance.close();
          await employee.close();
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

  // Scheduled runs (reminders every 5 minutes, close-day, cleanups) use the fixed clock
  // and would fire whenever a test crosses their minute; tests run the work directly.
  for (const name of QUEUES) {
    const q = queue(stack, name);
    for (const scheduler of await q.getJobSchedulers()) {
      if (scheduler.key) await q.removeJobScheduler(scheduler.key);
    }
  }
  stacks.add(stack);
  return stack;
}

/** Monday 2 November 2026, 10:00 in Jakarta (UTC+7). */
export const DEFAULT_NOW = "2026-11-02T03:00:00.000Z";

export const clockOf = (app: NestExpressApplication): FixedClock => app.get(Clock) as FixedClock;

export async function resetDatabase(app: NestExpressApplication): Promise<void> {
  await app.get(EmployeeDb)
    .$executeRaw`TRUNCATE audit_logs, employees, divisions, uploads, user_tokens, password_reset_tokens, refresh_tokens, sessions, users, roles, organizations RESTART IDENTITY CASCADE`;
  await app.get(AttendanceDb)
    .$executeRaw`TRUNCATE notification_preferences, notifications, verification_photo_requests, attendance_verifications, verification_pending_photos, work_locations, verification_notice_acknowledgements, correction_snapshots, correction_requests, idempotency_records, attendances, holidays, work_schedules, employees, divisions, organizations RESTART IDENTITY CASCADE`;
}

const queue = (app: NestExpressApplication, name: string): Queue =>
  app.get<Queue>(getQueueToken(name));

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
  const prisma = app.get(EmployeeDb);
  const n = ++sequence;
  const password = `correct-horse-battery-${n}`;
  let organizationId = options.sameOrganizationAs?.organizationId;
  if (!organizationId) {
    const { id, name } = await prisma.organization.create({ data: { name: `Org ${n}` } });
    await app.get(AttendanceDb).organization.create({ data: { id, name } });
    organizationId = id;
  }
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
  const session = await app.get(EmployeeDb).session.create({
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
  const division = await app.get(EmployeeDb).division.create({
    data: {
      organizationId: owner.organizationId,
      code: `DIV-${n}`,
      name: options.name ?? `Division ${n}`,
      status: options.inactive ? "inactive" : "active",
    },
  });
  await app.get(AttendanceDb).division.create({ data: division });
  const { id, code, name } = division;
  return { id, code, name };
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
  const {
    workEmail: _workEmail,
    jobTitle: _jobTitle,
    ...employee
  } = await app.get(EmployeeDb).employee.create({
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
  });
  await app.get(AttendanceDb).employee.create({ data: employee });
  return {
    id: employee.id,
    employeeNumber: employee.employeeNumber,
    divisionId: employee.divisionId,
  };
}

/** A schedule version straight in the database: the baseline unless overridden. */
export async function createSchedule(
  app: NestExpressApplication,
  owner: Pick<TestUser, "id" | "organizationId">,
  options: { effectiveFrom?: string; effectiveTo?: string; timezone?: string } = {},
): Promise<{ id: string }> {
  const time = (value: string) => new Date(`1970-01-01T${value}Z`);
  const createdBy = await app.get(EmployeeDb).user.findUnique({ where: { id: owner.id } });
  return app.get(AttendanceDb).workSchedule.create({
    data: {
      organizationId: owner.organizationId,
      createdById: owner.id,
      createdByName: createdBy?.name ?? "",
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
