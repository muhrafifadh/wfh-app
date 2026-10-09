import type { Type } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";

import { hash } from "@node-rs/argon2";

import { AppModule } from "@/app.module.js";
import type { Permission } from "@/common/types/auth.js";
import { AppConfig } from "@/config/config.module.js";
import type { Env } from "@/config/env.js";
import { configureApp } from "@/configure-app.js";
import { PrismaService } from "@/infra/prisma/prisma.service.js";

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
  const { config } = options;
  if (config) {
    builder.overrideProvider(AppConfig).useFactory({
      factory: (nestConfig: ConfigService<Env, true>) => new OverriddenConfig(nestConfig, config),
      inject: [ConfigService],
    });
  }
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
    .$executeRaw`TRUNCATE password_reset_tokens, refresh_tokens, sessions, users, roles, organizations RESTART IDENTITY CASCADE`;
}

export type TestUser = { id: string; email: string; password: string; organizationId: string };

let sequence = 0;

export async function createUser(
  app: NestExpressApplication,
  options: { permissions?: Permission[]; disabled?: boolean } = {},
): Promise<TestUser> {
  const prisma = app.get(PrismaService);
  const n = ++sequence;
  const password = `correct-horse-battery-${n}`;
  const organization = await prisma.organization.create({ data: { name: `Org ${n}` } });
  const role = await prisma.role.create({
    data: { organizationId: organization.id, name: "test", permissions: options.permissions ?? [] },
  });
  const user = await prisma.user.create({
    data: {
      email: `user${n}@example.test`,
      name: `User ${n}`,
      organizationId: organization.id,
      roleId: role.id,
      passwordHash: await hash(password),
      disabledAt: options.disabled ? new Date() : null,
    },
  });
  return { id: user.id, email: user.email, password, organizationId: organization.id };
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
