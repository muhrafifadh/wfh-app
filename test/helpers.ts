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
import { PrismaService } from "@/infra/prisma/prisma.service.js";
import { PASSWORD_RESET_QUEUE } from "@/modules/auth/jobs/password-reset.queue.js";
import { UPLOADS_CLEANUP_QUEUE } from "@/modules/uploads/jobs/uploads-cleanup.queue.js";
import { USER_EMAILS_QUEUE } from "@/modules/users/jobs/user-emails.queue.js";

const QUEUES = [USER_EMAILS_QUEUE, PASSWORD_RESET_QUEUE, UPLOADS_CLEANUP_QUEUE];

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

/** The real app with the production setup, plus optional test-only controllers. */
export async function createTestApp(
  controllers: Type[] = [],
  options: { config?: Partial<Env> } = {},
): Promise<NestExpressApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule], controllers });
  // Each app gets its own queues: a job left over from one test can never be picked
  // up by the next test's worker (while that test is truncating the database).
  const config: Partial<Env> = { QUEUE_PREFIX: `test-${randomUUID()}`, ...options.config };
  builder.overrideProvider(AppConfig).useFactory({
    factory: (nestConfig: ConfigService<Env, true>) => new OverriddenConfig(nestConfig, config),
    inject: [ConfigService],
  });
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

export async function resetDatabase(app: NestExpressApplication): Promise<void> {
  await app.get(PrismaService)
    .$executeRaw`TRUNCATE audit_logs, uploads, user_tokens, password_reset_tokens, refresh_tokens, sessions, users, roles, organizations RESTART IDENTITY CASCADE`;
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
