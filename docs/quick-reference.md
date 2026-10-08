# Quick Reference

A one-page summary of the rules. Each line links to the doc that explains it.

## Where does it go?

| I'm writing… | Put it in |
|---|---|
| An HTTP endpoint | `src/modules/<m>/<m>.controller.ts` → [03](03-modules-and-layers.md) |
| Business logic | `src/modules/<m>/<m>.service.ts` |
| A Prisma query | `src/modules/<m>/<m>.repository.ts` → [07](07-database-and-prisma.md) |
| Request / response shapes | `src/modules/<m>/dto/` → [06](06-validation-and-dtos.md) |
| A module-specific error | `src/modules/<m>/<m>.errors.ts` → [10](10-error-handling.md) |
| A guard, decorator, filter, or pipe used by many modules | `src/common/` |
| An external system client (DB, mail, storage, queue) | `src/infra/` |
| An env var | `src/config/env.ts` + `.env.example` → [11](11-configuration.md) |
| A schema change | `prisma/schema.prisma` + a migration → [playbook](playbooks/database-migration.md) |
| A background job | `src/modules/<m>/jobs/` → [15](15-background-jobs.md) |

## Request lifecycle

```
request
  → helmet / CORS / rate limit             (13)
  → JwtAuthGuard     (global; @Public() skips it)          (08)
  → PermissionsGuard (@RequirePermissions(...))            (09)
  → ZodValidationPipe (DTOs)                               (06)
  → Controller → Service → Repository → Prisma             (03, 07)
  → ZodSerializerInterceptor (response DTO)                (06)
  → AllExceptionsFilter (errors → standard error body)     (10)
response
```

## API contract at a glance

| | Shape |
|---|---|
| Base path | `/v1` |
| Success | The resource itself, with no wrapper |
| List | `{ items, page, pageSize, total }` |
| Error | `{ error: { code, message, details?, requestId } }` |
| Auth | `Authorization: Bearer <accessToken>` |
| Permissions | `resource:action` strings, e.g. `invoice:create` |

See [05 API design](05-api-design.md) for the details.

## Ten rules people break most

1. A controller with business logic or Prisma calls in it. → [03](03-modules-and-layers.md)
2. A service calling `this.prisma.<model>` directly instead of going through the repository. → [03](03-modules-and-layers.md)
3. Returning a Prisma model without a response DTO, which leaks fields like `passwordHash`. → [06](06-validation-and-dtos.md)
4. A new endpoint without `@RequirePermissions` that also isn't marked `@Public()`. → [09](09-authorization.md)
5. Loading records by ID without checking that the user owns or can access them (IDOR). → [09](09-authorization.md)
6. Throwing `HttpException` from a service. Throw an `AppError`. → [10](10-error-handling.md)
7. Writing to several tables without a transaction. → [07](07-database-and-prisma.md)
8. Editing a migration that has already been applied. → [playbook](playbooks/database-migration.md)
9. Reading `process.env` outside `config/`. → [11](11-configuration.md)
10. Logging tokens, passwords, or full request bodies. → [12](12-logging-and-observability.md)

## Before you push

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

Then go through the [PR checklist](playbooks/pr-checklist.md).
