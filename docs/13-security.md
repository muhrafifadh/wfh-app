# 13 · Security

Authentication and authorization have their own docs ([08](08-authentication.md), [09](09-authorization.md)). This doc covers everything else.

## Rules

### HTTP

- **Use `helmet()`** with default settings (set in `configureApp()`).
- **CORS uses an allowlist** from `CORS_ORIGINS`. Never use `origin: "*"`, and never allow credentials together with a wildcard origin.
- **`TRUST_PROXY` lists exactly the proxies allowed to set `X-Forwarded-For`**: the frontend server, plus any load balancer in front of the backend. Use addresses, CIDRs, `loopback`, or a hop count. `true` is refused at startup, because any client could then pick its own IP and get around rate limits.
- **Rate limits are per client, not per caller.** All user traffic arrives from the Next server, so the frontend forwards `X-Forwarded-For` on every backend call, and Express takes the rightmost untrusted address as `req.ip`. In production, Next itself must run behind a proxy that appends the real client IP (Vercel, nginx, ALB). Next only fills the header in when it's missing.
- **Limit body size:** JSON 1 MB by default. Endpoints that need more set their own limit.
- **Set timeouts:** requests 30 s, outgoing HTTP calls 10 s, database statements 15 s (`statement_timeout`).

### Rate limiting

- **`AppThrottlerGuard` runs globally:** 100 requests/minute per client IP by default, with tighter limits on auth endpoints ([08](08-authentication.md)). `@ThrottleKey("field")` also keys a route by a body field (login uses the email). Routes with `@ThrottleKey` also get the `perIp` throttler, which counts by client IP only, so one client can't spread attempts across many accounts.
- **When more than one instance runs, store the counters in Redis.** Otherwise each instance keeps its own counter and the real limit is multiplied by the number of instances.
- **Use `@SkipThrottle()` only for health checks** and authenticated webhooks.

### Input & output

- **Validate every input with strict Zod DTOs** ([06](06-validation-and-dtos.md)). Unknown keys are rejected, which stops mass assignment.
- **Filter every output through a response DTO**, so internal fields can't leak.
- **SQL only through Prisma or the tagged `$queryRaw`.** Never `$queryRawUnsafe` with input from users ([07](07-database-and-prisma.md)).
- **Don't build shell commands, file paths, regexes, or redirect URLs from user input.** If you must, validate against an allowlist.

### Files

- **Uploads go straight to object storage through presigned URLs.** The API only issues the URL and records the file's metadata.
- **Check file type by content (magic bytes), not by extension or `Content-Type`.** Enforce size limits when issuing the presigned URL.
- **Store files with generated keys (UUIDs), never with the name the user gave.** Serve them through short-lived signed URLs.
- The flow and its implementation: [17 File uploads](17-file-uploads.md).

### Outgoing requests

- **Webhooks or URL fetches to addresses users provide must be protected against SSRF** (Server-Side Request Forgery: tricking the server into calling internal services). Resolve the DNS name, block private, loopback, and link-local IP ranges, disable redirects (or check each redirect), and set a timeout.
- **Verify webhook signatures from third parties** with a constant-time comparison (`crypto.timingSafeEqual`), and reject old timestamps so captured requests can't be replayed.

### Secrets & dependencies

- **Secrets only live in the environment or a secret manager** ([11](11-configuration.md)). If one is exposed anywhere, rotate it right away.
- **`pnpm audit --prod` runs in CI.** High or critical issues block the merge unless a waiver explains why.
- **Renovate/Dependabot keeps dependencies updated.** Review and merge security patches within a week.
- **Run the production Docker image as a non-root user**, built in multiple stages so it contains no dev dependencies.

### Data

- **Collect only the personal data you need.** Document why each personal-data field is stored.
- **Personal data never appears in URLs** (query strings end up in logs and browser history).
- **Exports and bulk reads are paginated, need a permission, and are audited** ([12](12-logging-and-observability.md)).

## Don't

- **Don't disable helmet, CORS, or throttling "just for now".**
- **Don't return different errors or take noticeably different time** for "this user exists" vs "this user doesn't exist" ([08](08-authentication.md)).
- **Don't write your own crypto.** Use `argon2`, `@nestjs/jwt`, and Node's `crypto.randomBytes` / `timingSafeEqual`.
- **Don't put secrets in test fixtures that look real.** Use obviously fake values.

## Related

[08 Authentication](08-authentication.md) · [09 Authorization](09-authorization.md) · [11 Configuration](11-configuration.md)
