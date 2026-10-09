// Development data. Safe to run repeatedly (upserts). Never runs in production.
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

import { PERMISSIONS } from "../src/common/types/auth.js";
import { PrismaClient } from "../src/generated/prisma/client.js";

config({ quiet: true });

const { DATABASE_URL, NODE_ENV, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;

if (NODE_ENV === "production") throw new Error("Refusing to seed a production database.");
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set.");
if (!SEED_ADMIN_PASSWORD || SEED_ADMIN_PASSWORD.length < 12) {
  throw new Error("Set SEED_ADMIN_PASSWORD (12+ characters) in .env before seeding.");
}

const email = (SEED_ADMIN_EMAIL ?? "admin@example.com").toLowerCase();
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });

async function main(): Promise<void> {
  const organization =
    (await prisma.organization.findFirst({ where: { name: "Acme" } })) ??
    (await prisma.organization.create({ data: { name: "Acme" } }));

  const owner = await prisma.role.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "owner" } },
    update: { permissions: [...PERMISSIONS] },
    create: { organizationId: organization.id, name: "owner", permissions: [...PERMISSIONS] },
  });

  await prisma.role.upsert({
    where: { organizationId_name: { organizationId: organization.id, name: "member" } },
    update: {},
    create: { organizationId: organization.id, name: "member", permissions: ["user:read"] },
  });

  await prisma.user.upsert({
    where: { email },
    update: { roleId: owner.id, disabledAt: null, deletedAt: null },
    create: {
      email,
      name: "Admin",
      organizationId: organization.id,
      roleId: owner.id,
      passwordHash: await hash(SEED_ADMIN_PASSWORD as string),
      emailVerifiedAt: new Date(),
    },
  });

  console.warn(`Seeded organization "Acme" with owner ${email}.`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
