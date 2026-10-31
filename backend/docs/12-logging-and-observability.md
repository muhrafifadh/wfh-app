# 12 · Logging & Observability

## Stack

| Concern           | Tool                                                                |
| ----------------- | ------------------------------------------------------------------- |
| Logging           | `nestjs-pino`: structured JSON in production, pretty-printed in dev |
| Request context   | `nestjs-cls`: request ID, user ID                                   |
| Health checks     | `@nestjs/terminus`                                                  |
| Tracing / metrics | OpenTelemetry (optional; set up in `src/instrumentation.ts`)        |

## Rules

### Logging

- **Use the injected `PinoLogger` / Nest `Logger`. Never use `console.*`** (oxlint enforces this).
- **Log structured fields, not values glued into the message:** `logger.info({ invoiceId, amount }, "Invoice sent")`, not `` `Invoice ${id} sent` ``.
- **Every log line includes `requestId`** (added automatically from CLS) and `userId` when one is known.
- **Request IDs:** use the incoming `x-request-id` header if it's a valid ID, otherwise generate a UUID. The ID is sent back in the `x-request-id` response header and in error bodies.
- **Use the right level:**

  | Level   | Use for                                                                                     |
  | ------- | ------------------------------------------------------------------------------------------- |
  | `error` | Unexpected failures that need someone to look at them (500s, failed jobs after all retries) |
  | `warn`  | Expected but notable events: 4xx from business rules, retries, approaching a limit          |
  | `info`  | Business events: user registered, invoice sent, job completed                               |
  | `debug` | Details for development. Off in production                                                  |

- **Never log secrets or personal data.** The pino `redact` config removes these paths automatically:

  ```ts
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "*.password",
    "*.passwordHash",
    "*.refreshToken",
    "*.accessToken",
    "*.token",
  ];
  ```

  Don't log whole request or response bodies. Log IDs instead.

- **Don't log 2xx requests and successful health checks one by one in production.** The HTTP request log is enough.

### Audit log

- Security-relevant and admin actions write a row to the `audit_logs` table: who (`actorId`, null when no signed-in user did it), what (`action`), which record (`targetType`, `targetId`), when, the `requestId` (to find the matching log lines), and small details in `metadata` (IP for sign-ins, changed field names, old/new role). Examples: login, failed login, password change, permission change, data export, admin viewing another organization.
- **Modules don't write audit rows themselves.** They emit a domain event that implements `AuditableEvent` (`src/common/events/auditable-event.ts`), and `AuditListener` (`modules/audit`) records it. To audit a new module, add a handler for its namespace (`@OnEvent("invoice.*")`).
- **Emit with `emitAsync()` and await it**, so the row exists before the response is sent. The one exception: failed sign-ins aren't awaited, because waiting only when the email exists would leak which emails exist through response time.
- `metadata` never holds tokens, passwords, or whole records.
- Audit rows are append-only. No update or delete endpoints exist for them. `GET /v1/audit-logs` (permission `audit:read`) lists the caller's organization, newest first.

### Health checks

| Endpoint            | Checks                          | Used by                                             |
| ------------------- | ------------------------------- | --------------------------------------------------- |
| `GET /health/live`  | Only that the process responds  | Liveness probe: restart the app if this fails       |
| `GET /health/ready` | Database `SELECT 1`, Redis ping | Readiness probe: stop sending traffic if this fails |

Health endpoints are `@Public()`, outside `/v1`, and excluded from rate limiting and request logs.

### Graceful shutdown

- `app.enableShutdownHooks()` is called in `configureApp()`. When the app receives `SIGTERM`, it: stops accepting traffic (readiness fails) → finishes requests already in progress → closes queue workers → disconnects Prisma/Redis.

## Don't

- **Don't use `console.log`.**
- **Don't log at `error` for things the client did wrong** (validation failures, 404s). It hides real alerts in noise.
- **Don't put personal data (emails, names, IPs) in log messages.** Put IDs instead. Personal data belongs in the audit log, which has access controls.
- **Don't let a health check call an external third-party API.** If that API goes down, every instance of the app is marked unhealthy and restarted.

## Related

[10 Error handling](10-error-handling.md) · [13 Security](13-security.md)
