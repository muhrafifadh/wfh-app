# 12 · Logging & Observability

## Stack

| Concern | Tool |
|---|---|
| Logging | `nestjs-pino`: structured JSON in production, pretty-printed in dev |
| Request context | `nestjs-cls`: request ID, user ID |
| Health checks | `@nestjs/terminus` |
| Tracing / metrics | OpenTelemetry (optional; set up in `src/instrumentation.ts`) |

## Rules

### Logging

- **Use the injected `PinoLogger` / Nest `Logger`. Never use `console.*`** (ESLint enforces this).
- **Log structured fields, not values glued into the message:** `logger.info({ invoiceId, amount }, "Invoice sent")`, not `` `Invoice ${id} sent` ``.
- **Every log line includes `requestId`** (added automatically from CLS) and `userId` when one is known.
- **Request IDs:** use the incoming `x-request-id` header if it's a valid ID, otherwise generate a UUID. The ID is sent back in the `x-request-id` response header and in error bodies.
- **Use the right level:**

  | Level | Use for |
  |---|---|
  | `error` | Unexpected failures that need someone to look at them (500s, failed jobs after all retries) |
  | `warn` | Expected but notable events: 4xx from business rules, retries, approaching a limit |
  | `info` | Business events: user registered, invoice sent, job completed |
  | `debug` | Details for development. Off in production |

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
  ]
  ```

  Don't log whole request or response bodies. Log IDs instead.
- **Don't log 2xx requests and successful health checks one by one in production.** The HTTP request log is enough.

### Audit log

- Security-relevant and admin actions write a row to the `audit_logs` table: who, what, which record, when, IP, and before/after values for changes. Examples: login, failed login, password change, permission change, data export, admin viewing another organization.
- Audit rows are append-only. No update or delete endpoints exist for them.

### Health checks

| Endpoint | Checks | Used by |
|---|---|---|
| `GET /health/live` | Only that the process responds | Liveness probe: restart the app if this fails |
| `GET /health/ready` | Database `SELECT 1`, Redis ping | Readiness probe: stop sending traffic if this fails |

Health endpoints are `@Public()`, outside `/v1`, and excluded from rate limiting and request logs.

### Graceful shutdown

- `app.enableShutdownHooks()` is called in `main.ts`. When the app receives `SIGTERM`, it: stops accepting traffic (readiness fails) → finishes requests already in progress → closes queue workers → disconnects Prisma/Redis.

## Don't

- **Don't use `console.log`.**
- **Don't log at `error` for things the client did wrong** (validation failures, 404s). It hides real alerts in noise.
- **Don't put personal data (emails, names, IPs) in log messages.** Put IDs instead. Personal data belongs in the audit log, which has access controls.
- **Don't let a health check call an external third-party API.** If that API goes down, every instance of the app is marked unhealthy and restarted.

## Related

[10 Error handling](10-error-handling.md) · [13 Security](13-security.md)
