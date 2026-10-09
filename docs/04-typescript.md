# 04 · TypeScript

## Rules

- **`strict: true`, `noUncheckedIndexedAccess: true`, and `noImplicitOverride: true` are all on.** Don't turn any of them off.
- **Don't use `any`.** Use `unknown` and narrow it. If `any` is truly unavoidable, disable the lint rule for that one line and explain why in a comment.
- **Don't use `!` (non-null assertion)** unless a comment on the same line explains why the value can't be null.
- **Use `@ts-expect-error` with a reason, never `@ts-ignore`.**
- **Data from outside the code is `unknown` until Zod parses it:** request bodies, query strings, headers, env vars, webhook payloads, responses from third-party APIs, queue job data. TypeScript only checks types at compile time.
- **Derive types instead of writing them twice:**
  - `z.infer<typeof schema>` for DTO-backed shapes
  - the generated Prisma types (`Invoice`, `Prisma.InvoiceGetPayload<{ include: … }>`) for database rows
  - `(typeof STATUSES)[number]` for unions built from constants
- **Use `type` by default.** Use `interface` only when you need declaration merging (e.g. augmenting the Express `Request` type).
- **Use Prisma enums for values stored in the database**, and string-literal unions for everything else. Don't use TS `enum`.
- **Public service and repository methods declare their return type.**
- **Use the `Tx` type for transaction clients:**

  ```ts
  // src/infra/prisma/prisma.types.ts
  export type Tx = Prisma.TransactionClient | PrismaService;
  ```

## Where types live

| Type                                              | Location                                          |
| ------------------------------------------------- | ------------------------------------------------- |
| Request/response shapes                           | `modules/<m>/dto/` (from Zod)                     |
| Database rows                                     | generated Prisma client. Don't write them by hand |
| Domain types for one module                       | `modules/<m>/<m>.types.ts`                        |
| Shared (`AuthUser`, `Permission`, `Paginated<T>`) | `src/common/types/`                               |

## Examples

```ts
// src/common/types/auth.ts
export const PERMISSIONS = [
  "invoice:read",
  "invoice:create",
  "invoice:update",
  "invoice:void",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export type AuthUser = {
  id: string;
  sessionId: string;
  organizationId: string;
};
```

```ts
// ✅ the job's data is parsed before it's used
const data = sendInvoiceJobSchema.parse(job.data);

// ❌ the cast tells TypeScript the shape is right without checking anything
const data = job.data as SendInvoiceJob;
```

## Don't

- **Don't use `as SomeType` to quiet an error.** Casting is only acceptable right after code that actually checks the shape, or for `as const`.
- **Don't hand-write a copy of a Prisma model's type.** Use the generated type, or `Prisma.XGetPayload`.
- **Don't return Prisma's `Decimal` or `bigint` in JSON without converting it.** The response DTO decides how they're serialized ([06](06-validation-and-dtos.md)).

## Related

[06 Validation & DTOs](06-validation-and-dtos.md) · [07 Database & Prisma](07-database-and-prisma.md)
