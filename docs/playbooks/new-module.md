# Playbook · New Module

Steps for adding a domain module (e.g. `invoices`) from scratch. Do them in order, and skip steps the module doesn't need.

You can create the skeleton with `pnpm nest g resource modules/invoices --no-spec`. Then make it match the layout below: add a repository, replace the DTOs with Zod DTOs, and delete the generated entity class.

## 1. Plan

- [ ] Name the module with a plural `kebab-case` noun.
- [ ] List the endpoints ([05](../05-api-design.md)), the permissions for each, and the error codes they can return.
- [ ] Agree on response shapes with the frontend before writing any code.

## 2. Schema & migration

- [ ] Add the model to `prisma/schema.prisma` following the conventions ([07](../07-database-and-prisma.md)): UUIDv7 `id`, `organizationId`, timestamps, `deletedAt`, indexes on foreign keys, `@@map`.
- [ ] `pnpm db:migrate --name add_invoices`, then review the generated SQL ([migration playbook](database-migration.md)).

## 3. Permissions

- [ ] Add `invoice:*` permissions to `PERMISSIONS` in `src/common/types/auth.ts`.
- [ ] Give them to roles in the seed and in a data migration.

## 4. DTOs: `dto/`

- [ ] `create-*.dto.ts`, `update-*.dto.ts`: strict Zod schemas with limits on every field.
- [ ] `list-*.query.ts`: pagination, filters, and allowed sort fields.
- [ ] `*.response.ts`: the response schema, plus the paginated list response.
- [ ] Unit tests for the schemas' custom rules.

→ [06 Validation & DTOs](../06-validation-and-dtos.md)

## 5. Errors: `<m>.errors.ts`

- [ ] One `AppError` subclass per business failure, each with a stable `code`.

→ [10 Error handling](../10-error-handling.md)

## 6. Repository: `<m>.repository.ts`

- [ ] `findById`, `findMany` (paginated, scoped to the organization, `deletedAt: null`), `insert`, `update`, `softDelete`.
- [ ] Every method accepts an optional `tx`. Translate `P2002`/`P2025` errors.
- [ ] A mapper from the Prisma row to the domain/response shape (dates → ISO).

→ [07 Database & Prisma](../07-database-and-prisma.md)

## 7. Service: `<m>.service.ts`

- [ ] Business rules, organization/ownership checks (404 for records in another organization), transactions.
- [ ] Throws `AppError` only. Nothing in it knows about HTTP.
- [ ] Unit tests for every rule.

→ [03 Modules & layers](../03-modules-and-layers.md) · [09 Authorization](../09-authorization.md)

## 8. Controller: `<m>.controller.ts`

- [ ] `@Controller("invoices")`, `@ApiTags`, and on every route: `@RequirePermissions`, `@ZodResponse`, and the documented error responses.
- [ ] Each method calls one service method.

## 9. Module wiring

- [ ] `<m>.module.ts` provides the service and repository and exports only the service.
- [ ] Register it in `app.module.ts`.
- [ ] Queues and processors (if any) in `jobs/` ([15](../15-background-jobs.md)).

## 10. Verify

- [ ] E2E tests for each endpoint: the authorization matrix, validation, the main flow, and the business-rule errors ([14](../14-testing.md)).
- [ ] Check the Swagger page at `/docs`, then run `pnpm openapi` and commit `openapi.json`.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`
- [ ] Go through the [PR checklist](pr-checklist.md), and link the frontend PR if one exists.

## Resulting layout

```
src/modules/invoices/
├── dto/
│   ├── create-invoice.dto.ts
│   ├── update-invoice.dto.ts
│   ├── list-invoices.query.ts
│   └── invoice.response.ts
├── invoices.module.ts
├── invoices.controller.ts
├── invoices.service.ts
├── invoices.service.spec.ts
├── invoices.repository.ts
├── invoices.errors.ts
└── invoices.constants.ts

test/invoices.e2e-spec.ts
```
