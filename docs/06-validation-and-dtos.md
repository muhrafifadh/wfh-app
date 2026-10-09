# 06 · Validation & DTOs

DTOs are written as **Zod schemas** with [`nestjs-zod`](https://github.com/BenLorantfy/nestjs-zod). Zod is also what the frontend uses, so both repos write validation the same way.

## Rules

- **Every body, query, and param input has a DTO.** The global `ZodValidationPipe` (registered as `APP_PIPE`) validates them before the controller runs.
- **Every response goes through a response DTO** (`@ZodSerializerDto(...)`). The global `ZodSerializerInterceptor` removes any field not in the schema, so internal fields can't leak even if the service returns a whole Prisma row.
- **Input schemas are strict:** `z.strictObject(...)`. Requests with unknown keys are rejected, which stops clients from setting fields they shouldn't (mass assignment).
- **Convert and clean values in the schema:** `.trim()` on strings, `.toLowerCase()` on emails, `z.coerce.number()` for query params.
- **Limit everything:** max string lengths, max array sizes, numeric ranges, and `pageSize` ≤ 100.
- **Validation messages are written for users.** The frontend shows them next to the field.
- **Build one schema from another** with `.pick()`, `.omit()`, `.extend()`, and `.partial()`. Don't copy fields.
- **Validate path IDs** with `ParseUUIDPipe` or a UUID schema.
- **Business rules go in the service, not the DTO.** "Must be a valid date" is a DTO rule. "The due date must be after the issue date of the customer's last invoice" is a service rule.

## Examples

```ts
// modules/invoices/dto/create-invoice.dto.ts
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { CURRENCIES } from "@/common/constants";

export const createInvoiceSchema = z.strictObject({
  number: z.string().trim().min(1, "Invoice number is required").max(50),
  customerId: z.uuid("Choose a customer"),
  amount: z.int().positive("Amount must be greater than 0"), // minor units
  currency: z.enum(CURRENCIES),
  dueDate: z.iso.date("Choose a due date"),
  notes: z.string().trim().max(2000).nullable().default(null),
});

export class CreateInvoiceDto extends createZodDto(createInvoiceSchema) {}
```

```ts
// modules/invoices/dto/update-invoice.dto.ts
export class UpdateInvoiceDto extends createZodDto(createInvoiceSchema.partial()) {}
```

```ts
// common/dto/pagination.ts
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    page: z.int(),
    pageSize: z.int(),
    total: z.int(),
  });
```

```ts
// modules/invoices/dto/list-invoices.query.ts
const SORTABLE = ["createdAt", "dueDate", "amount", "number"] as const;

export const listInvoicesQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  status: z.union([z.enum(INVOICE_STATUSES), z.array(z.enum(INVOICE_STATUSES))]).optional(),
  sort: z.enum([...SORTABLE, ...SORTABLE.map((f) => `-${f}` as const)]).default("-createdAt"),
});

export class ListInvoicesQuery extends createZodDto(listInvoicesQuerySchema) {}
```

```ts
// modules/invoices/dto/invoice.response.ts
export const invoiceResponseSchema = z.object({
  id: z.uuid(),
  number: z.string(),
  customerId: z.uuid(),
  status: z.enum(INVOICE_STATUSES),
  amount: z.int(),
  currency: z.enum(CURRENCIES),
  dueDate: z.iso.date(),
  notes: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export class InvoiceResponse extends createZodDto(invoiceResponseSchema) {}
export class InvoiceListResponse extends createZodDto(paginated(invoiceResponseSchema)) {}
```

> Prisma returns `Date` objects, but the response schema expects ISO strings. Convert them in the repository's mapper (`toInvoice(row)`), or with a codec that the shared `common/dto` helpers set up once. Never convert dates by hand inside controllers.

## Don't

- **Don't use `class-validator` / `class-transformer`.** This project uses one validation library, and that library is Zod.
- **Don't return Prisma rows without a response DTO.**
- **Don't accept `id`, `organizationId`, `createdById`, `role`, or `status` in a create body** unless the client is genuinely allowed to set it. The server sets these values.
- **Don't validate in the controller by hand** (`if (!body.amount) throw …`).
- **Don't put an unlimited `z.string()` on user input.**

## Related

[05 API design](05-api-design.md) · [04 TypeScript](04-typescript.md) · [13 Security](13-security.md)
