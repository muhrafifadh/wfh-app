# 07 · Database & Prisma

> These docs target **Prisma 7** (the `prisma-client` generator, the `@prisma/adapter-pg` driver adapter, and `prisma.config.ts`). If the pinned version is different, check the Prisma docs.

## Schema conventions

| Thing                        | Convention                                                         | Example                                       |
| ---------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| Models                       | `PascalCase`, singular                                             | `model Invoice`                               |
| Fields                       | `camelCase`                                                        | `dueDate`                                     |
| Tables / columns in Postgres | `snake_case` via `@@map` / `@map`                                  | `invoices`, `due_date`                        |
| Enums                        | `PascalCase` type, lowercase values (same strings the API returns) | `enum InvoiceStatus { draft sent paid void }` |
| Primary key                  | `id String @id @default(uuid(7)) @db.Uuid`                         |                                               |
| Foreign keys                 | `<relation>Id`, always indexed                                     | `customerId` + `@@index([customerId])`        |

**Every model has:**

```prisma
model Invoice {
  id             String        @id @default(uuid(7)) @db.Uuid
  organizationId String        @map("organization_id") @db.Uuid
  number         String
  customerId     String        @map("customer_id") @db.Uuid
  status         InvoiceStatus @default(draft)
  amount         Int                                   // minor units
  currency       String        @db.Char(3)
  dueDate        DateTime      @map("due_date") @db.Date
  notes          String?
  createdById    String        @map("created_by_id") @db.Uuid
  createdAt      DateTime      @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt      DateTime      @updatedAt @map("updated_at") @db.Timestamptz(3)
  deletedAt      DateTime?     @map("deleted_at") @db.Timestamptz(3)

  organization Organization @relation(fields: [organizationId], references: [id])
  customer     Customer     @relation(fields: [customerId], references: [id])

  @@unique([organizationId, number])
  @@index([organizationId, status, createdAt])
  @@index([customerId])
  @@map("invoices")
}
```

## Rules

### Schema

- **Timestamps are `@db.Timestamptz` and stored in UTC.** Date-only fields use `@db.Date`.
- **Money is an `Int` (or `BigInt`) in minor units, plus a currency code.** Never use `Float`. Use `Decimal` only for rates or percentages.
- **Every foreign key has an index.** Postgres doesn't create them automatically.
- **Enforce data integrity in the database:** use `@unique`, foreign keys, `NOT NULL`, and check constraints (added in the migration SQL). App code can have bugs, and the database still protects the data.
- **Choose `onDelete` on purpose for every relation.** The default is `Restrict`. Use `Cascade` only for child rows that can't exist without their parent (e.g. invoice lines).
- **Soft-delete user-facing business records** with `deletedAt`. Every query on those records filters on `deletedAt: null` (in the repository). Hard-delete technical data (sessions, tokens) when it expires.

### Migrations

- **Every schema change ships as a migration** created with `prisma migrate dev --name <what_changed>`. Follow the [migration playbook](playbooks/database-migration.md).
- **Never edit a migration after it has been merged.** Fix it with a new migration.
- **Never run `prisma db push` against any shared database.** Use it only for quick local experiments.
- **Production runs `prisma migrate deploy`** as a separate step before the app starts.

### Queries

- **Only repositories call Prisma** ([03](03-modules-and-layers.md)). The one exception is a service starting a `$transaction`.
- **Select only what you need.** Use `select` or a named `include` shape when the full row or relations aren't needed.
- **Avoid N+1 queries.** Don't query inside a loop. Use `include`, `where: { id: { in: ids } }`, or one grouped query.
- **Use only the pagination params from the DTO.** Always set `take` and `skip` (or a cursor) and an explicit `orderBy` that ends with a unique field (`id`), so the order is stable.
- **Raw SQL must use the tagged template** (`prisma.$queryRaw\`…${value}\``) so values are passed as parameters. Never use `$queryRawUnsafe` with user input.
- **Repositories translate the Prisma errors they expect:** `P2002` (unique violation) → a domain conflict error, `P2025` (record not found) → `NotFoundError`. Everything else is rethrown ([10](10-error-handling.md)).

### Transactions

- **Writes that touch more than one row or table and must succeed or fail together run in a transaction.**
- **Use interactive transactions**, and pass `tx` to the repository methods:

```ts
async markPaid(user: AuthUser, id: string, payment: RecordPaymentDto) {
  return this.prisma.$transaction(async (tx) => {
    const invoice = await this.repo.findByIdForUpdate(id, tx);
    if (!invoice || invoice.organizationId !== user.organizationId) throw new NotFoundError("Invoice");
    if (invoice.status === "paid") throw new InvoiceAlreadyPaidError(id);

    await this.payments.record({ invoiceId: id, ...payment }, tx);
    return this.repo.update(id, { status: "paid" }, tx);
  });
}
```

- **Keep transactions short.** No HTTP calls, emails, or queue jobs inside them. Do those after the commit, or use the outbox pattern ([15](15-background-jobs.md)).
- **When concurrent requests could cause a lost update,** lock the row (`SELECT … FOR UPDATE` via `$queryRaw` in a `findByIdForUpdate` repository method) or use an optimistic `version` column.

## Prisma client setup

```ts
// src/infra/prisma/prisma.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";

import { AppConfig } from "@/config/config.module";
import { PrismaClient } from "@/generated/prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: AppConfig) {
    super({
      adapter: new PrismaPg({ connectionString: config.get("DATABASE_URL") }),
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

## Seeding

- `prisma/seed.ts` creates **development** data: an admin user, an org, and sample records. It must be safe to run more than once (use upserts).
- E2E tests use their own fixtures and factories ([14](14-testing.md)), not the dev seed.

## Don't

- **Don't use `Float` for money.**
- **Don't add a foreign key without an index.**
- **Don't make network calls inside `$transaction`.**
- **Don't build SQL with string concatenation.**
- **Don't call `findMany()` without `take`** on a table that grows.
- **Don't forget the `deletedAt: null` filter.** Keep it inside the repository, where it can't be skipped.

## Related

[Playbook: database migration](playbooks/database-migration.md) · [03 Modules & layers](03-modules-and-layers.md) · [10 Error handling](10-error-handling.md)
