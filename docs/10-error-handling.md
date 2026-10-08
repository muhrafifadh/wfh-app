# 10 · Error Handling

## Two kinds of failure

| | Expected | Unexpected |
|---|---|---|
| Examples | Not found, conflict, validation, forbidden, business rule | Bug, database down, timeout, unexpected Prisma error |
| Thrown as | An `AppError` subclass with a stable `code` | Anything else |
| HTTP | The status set on the error class (4xx) | `500 INTERNAL_ERROR` |
| Message to client | The error's message, written for users | A generic message only |
| Logged as | `warn` (or not logged, for 404s) | `error`, with the stack trace |

## Rules

- **Services throw `AppError` subclasses, never `HttpException`.** Services don't know about HTTP ([03](03-modules-and-layers.md)).
- **One global `AllExceptionsFilter`** turns every error into the standard body ([05](05-api-design.md#errors)). No other filters, and no `try/catch` in controllers.
- **Each error has a `code` in `SCREAMING_SNAKE_CASE`. Codes never change once released**, because the frontend uses them to decide what to do.
- **Module-specific errors live in `<m>.errors.ts`.** Generic ones (`NotFoundError`, `ForbiddenError`, `ConflictError`, `UnauthenticatedError`) live in `common/errors/`.
- **Only catch an error if you can handle it:** translate it (Prisma `P2002` → a conflict error), retry it, or add context. Otherwise let it reach the filter.
- **Every error response includes the `requestId`**, so a support ticket can be matched to the logs.
- **500 responses never include stack traces, SQL, Prisma messages, or internal details.**

## The base class

```ts
// common/errors/app-error.ts
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;

  constructor(message: string, readonly details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = "NOT_FOUND";
  constructor(resource: string) {
    super(`${resource} not found.`);
  }
}

export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code = "FORBIDDEN";
  constructor() {
    super("You don't have permission to do this.");
  }
}
```

```ts
// modules/invoices/invoices.errors.ts
export class InvoiceNumberTakenError extends AppError {
  readonly status = 409;
  readonly code = "INVOICE_NUMBER_TAKEN";
  constructor(number: string) {
    super("An invoice with this number already exists.", { fieldErrors: { number: ["Already in use"] } });
  }
}
```

## The filter

```ts
// common/filters/all-exceptions.filter.ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger, private readonly cls: ClsService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const requestId = this.cls.getId();
    const { status, body } = toErrorResponse(exception); // AppError | ZodValidationException | HttpException | unknown

    if (status >= 500) this.logger.error({ err: exception, requestId }, "Unhandled error");
    else if (status !== 404) this.logger.warn({ code: body.code, requestId }, body.message);

    res.status(status).json({ error: { ...body, requestId } });
  }
}
```

`toErrorResponse` maps:

| Input | Output |
|---|---|
| `AppError` | its `status`, `code`, `message`, `details` |
| `ZodValidationException` (from `nestjs-zod`) | `400 VALIDATION_FAILED` + `details.fieldErrors` |
| `ThrottlerException` | `429 RATE_LIMITED` |
| Nest `HttpException` (from framework code, e.g. `ParseUUIDPipe`) | its status + a generic code (`BAD_REQUEST`, `NOT_FOUND`, …) |
| Anything else | `500 INTERNAL_ERROR`, `"Something went wrong."` |

## Prisma errors

Repositories translate the errors they expect, and nothing else:

```ts
try {
  return await tx.invoice.create({ data });
} catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new InvoiceNumberTakenError(data.number);
  }
  throw e;
}
```

## Don't

- **Don't `throw new HttpException(...)` or `new BadRequestException(...)` from a service.**
- **Don't write `catch (e) { this.logger.error(e) }` and then carry on.** That swallows the error and hides the failure.
- **Don't return `null` to signal an error** from a service method that should always find a record. Throw `NotFoundError`.
- **Don't build error messages from user input** without sanitizing it, or from internal state (IDs of other tenants, SQL).
- **Don't rename or reuse error codes.**

## Related

[05 API design](05-api-design.md) · [12 Logging & observability](12-logging-and-observability.md) · [07 Database & Prisma](07-database-and-prisma.md)
