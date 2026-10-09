# 02 · Naming & Code Style

## Files

Files follow NestJS conventions: `<name>.<role>.ts`, in `kebab-case`.

| Role          | File                                                  | Class                     |
| ------------- | ----------------------------------------------------- | ------------------------- |
| Module        | `invoices.module.ts`                                  | `InvoicesModule`          |
| Controller    | `invoices.controller.ts`                              | `InvoicesController`      |
| Service       | `invoices.service.ts`                                 | `InvoicesService`         |
| Repository    | `invoices.repository.ts`                              | `InvoicesRepository`      |
| Request DTO   | `dto/create-invoice.dto.ts`                           | `CreateInvoiceDto`        |
| Query DTO     | `dto/list-invoices.query.ts`                          | `ListInvoicesQuery`       |
| Response DTO  | `dto/invoice.response.ts`                             | `InvoiceResponse`         |
| Errors        | `invoices.errors.ts`                                  | `InvoiceNumberTakenError` |
| Guard         | `permissions.guard.ts`                                | `PermissionsGuard`        |
| Decorator     | `current-user.decorator.ts`                           | `CurrentUser`             |
| Job processor | `jobs/send-invoice.processor.ts`                      | `SendInvoiceProcessor`    |
| Unit test     | `invoices.service.spec.ts`, next to the file it tests |                           |
| E2E test      | `test/invoices.e2e-spec.ts`                           |                           |

Module folders and route paths use the **plural** noun (`invoices`). Classes describing a single record use the singular (`InvoiceResponse`).

## Code naming

| Thing                  | Convention             | Example                            |
| ---------------------- | ---------------------- | ---------------------------------- |
| Classes, types         | `PascalCase`           | `InvoicesService`, `InvoiceStatus` |
| Methods, variables     | `camelCase`            | `findById`, `dueDate`              |
| Module-level constants | `SCREAMING_SNAKE_CASE` | `MAX_PAGE_SIZE`                    |
| Booleans               | `is` / `has` / `can`   | `isOverdue`                        |
| Zod schemas            | `camelCase` + `Schema` | `createInvoiceSchema`              |
| Error codes            | `SCREAMING_SNAKE_CASE` | `INVOICE_NUMBER_TAKEN`             |
| Permissions            | `resource:action`      | `invoice:create`                   |
| Queue names            | `kebab-case`           | `invoice-emails`                   |

## Method names by layer

| Layer      | Verbs                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------- |
| Controller | Named after the HTTP action: `create`, `findAll`, `findOne`, `update`, `remove`                                      |
| Service    | Named after what happens in the business: `create`, `send`, `markPaid`, `void`                                       |
| Repository | Named after what happens in the database: `findById`, `findMany`, `insert`, `update`, `softDelete`, `existsByNumber` |

## Code style

- **Named exports only.** Don't use default exports.
- **Use the `@/` alias for `src/`.** Relative imports are only allowed within the same module folder (`./dto/...`). Never write `../../`.
- **Import order:** Node built-ins → `@nestjs/*` → other external packages → `@/` → relative imports. Prettier (`@ianvs/prettier-plugin-sort-imports`) sorts them on save.
- **Imports end in `.js`** (the project is ESM): `import { AppConfig } from "@/config/config.module.js"`.
- **Don't use `import type` for classes you inject.** Nest reads constructor parameter types at runtime to resolve dependencies. A type-only import removes the class from the compiled code, and dependency injection fails.
- **Use constructor injection with `private readonly`.** Don't use property injection.
- **Use `async`/`await`.** Don't chain `.then()`. Never leave a promise floating without awaiting it (oxlint `no-floating-promises`).
- **Return early** instead of nesting `if/else`.
- **Comments explain _why_, not _what_.** If the code needs a comment to explain _what_ it does, rename things or split it up.

## Don't

- **Don't use abbreviations** (`inv`, `cust`, `usr`). Common ones are fine: `id`, `url`, `dto`, `tx`.
- **Don't give classes generic names** like `Manager`, `Helper`, or `Handler` without saying what domain they belong to.
- **Don't mix singular and plural** route paths (`/invoice/:id` next to `/invoices`).

## Related

[01 Project structure](01-project-structure.md) · [16 Tooling & Git](16-tooling-and-git.md)
