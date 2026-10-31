# 08 · Authentication

**Who is calling?** This doc covers login and tokens. _What_ a caller is allowed to do is in [09 Authorization](09-authorization.md).

## Model

| Token             | Format                                          | Lifetime              | Stored by the backend                    | Stored by the frontend                |
| ----------------- | ----------------------------------------------- | --------------------- | ---------------------------------------- | ------------------------------------- |
| **Access token**  | JWT (HS256), claims: `sub`, `sid`, `iat`, `exp` | **15 minutes**        | Not stored                               | httpOnly cookie on the Next.js server |
| **Refresh token** | 32 random bytes, base64url                      | **30 days** (sliding) | **SHA-256 hash** in the `sessions` table | httpOnly cookie on the Next.js server |

The Next.js server is the only client that holds the tokens. It sends the access token as `Authorization: Bearer <token>` on every request, and calls `/auth/refresh` when the token expires.

## Endpoints

| Method & path                              | Auth                             | Purpose                                                                                                 |
| ------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `POST /v1/auth/register`                   | Public                           | Create a new organization with the caller as owner, and sign in. 404 unless `REGISTRATION_ENABLED=true` |
| `POST /v1/auth/login`                      | Public                           | Email + password → `{ accessToken, refreshToken, accessTokenExpiresAt }`                                |
| `POST /v1/auth/refresh`                    | Public (needs the refresh token) | Exchange the refresh token for a **new pair of tokens**                                                 |
| `POST /v1/auth/logout`                     | Bearer                           | End the current session                                                                                 |
| `POST /v1/auth/logout-all`                 | Bearer                           | End all of this user's sessions                                                                         |
| `POST /v1/auth/password-reset/request`     | Public                           | Email a reset link. Always `202`                                                                        |
| `POST /v1/auth/password-reset/confirm`     | Public                           | `{ token, password }` → `204`; signs out every session                                                  |
| `POST /v1/auth/invitations/accept`         | Public                           | `{ token, password }` from the invitation email → token pair; marks the email verified                  |
| `POST /v1/auth/email-verification/confirm` | Public                           | `{ token }` from the verification email → `204`                                                         |
| `POST /v1/auth/email-verification/resend`  | Bearer                           | Email a new verification link. `202`; nothing is sent if already verified                               |
| `GET /v1/auth/me`                          | Bearer                           | Current user + `permissions[]`. The frontend's `getSession()` calls this                                |

## Rules

### Passwords

- **Hash passwords with Argon2id** (`argon2` package, default settings or stronger). Never use bcrypt with a low cost factor, SHA, or MD5.
- **Passwords must be at least 12 characters** (max 256), with no rules about which kinds of characters to include (`newPasswordSchema` in `modules/auth/dto/password.ts`). Reject passwords that appear in known breaches (k-anonymity check against HaveIBeenPwned) when the user registers or changes their password. _Not built yet._
- **Registration says when an email is taken** (`409 EMAIL_TAKEN`): the user needs to know. Its rate limit (3/hour per client) keeps that from being a way to list registered emails.
- **When login fails, return the same error and take the same time** whether or not the email exists: `401 INVALID_CREDENTIALS`. If the user isn't found, verify the password against a dummy hash anyway, so response timing doesn't reveal which emails are registered.

### Access tokens

- **Sign with `JWT_ACCESS_SECRET`** (at least 32 random bytes) using `@nestjs/jwt`. Verify the algorithm, `exp`, `iss`, and `aud` on every request.
- **The token contains only `sub` (user ID) and `sid` (session ID).** Don't put permissions or personal data in it. Permissions are loaded on each request ([09](09-authorization.md)), so a change takes effect right away instead of after the token expires.
- **Every request checks that the session is still active and the user isn't disabled.** The guard loads the user's permissions anyway, so checking the session as well costs little, and it makes logout and reuse revocation take effect immediately instead of up to 15 minutes later.

### Refresh tokens & sessions

- **Store only the hash.** The raw token is returned once and never logged.
- **Issue a new refresh token every time one is used.** Each `/auth/refresh` call invalidates the old token and returns a new one.
- **Detect reuse:** if someone presents a refresh token that was already used, **revoke its whole session** and return `401 REFRESH_TOKEN_REUSED`. This means the token was stolen.
- **Concurrent refreshes aren't theft.** If a token comes back within **10 seconds** of being used (two tabs, or parallel requests refreshing at once), the caller gets a new token pair for the same session instead of having it revoked (`REFRESH_REUSE_GRACE_MS`).
- **The revocation happens outside the refresh transaction.** Throwing inside `$transaction` would roll the revocation back.
- **A session** (`sessions`) records `userId`, `expiresAt` (sliding: extended on every refresh), `lastUsedAt`, `userAgent`, `ip`, and `revokedAt`. **Each refresh token** (`refresh_tokens`) records its `tokenHash`, `expiresAt` and `usedAt`, and belongs to one session.
- **Changing your password revokes every other session.**
- **A scheduled job removes sessions** that expired or were revoked more than 30 days ago.

### Guards & decorators

- **`JwtAuthGuard` is global** (`APP_GUARD`). **Every route requires a valid token by default.** It lives in `modules/auth/guards/` because it needs `AuthService`, and `common/` must not import from `modules/`.
- **Use `@Public()` to make a route public.** Every `@Public()` gets extra attention in review.
- **Use `@Authenticated()` for routes any signed-in user may call** (`/auth/me`, `/auth/logout`). Use `@RequirePermissions(...)` for everything else ([09](09-authorization.md)).
- **Read the current user with `@CurrentUser()`.** It returns `AuthUser` (`{ id, sessionId, organizationId, permissions }`). Never read `req.user` directly.

```ts
// modules/auth/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const token = BEARER.exec(req.get("authorization") ?? "")?.[1];
    if (!token) throw new UnauthenticatedError();

    // Verifies the JWT (TOKEN_EXPIRED if expired), then checks the session and loads the user
    req.user = await this.auth.authenticate(token);
    return true;
  }
}
```

### Rate limits

| Endpoint                                | Limit                                                                                                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/login`                      | 5 / minute per client IP + email (`@ThrottleKey("email")`), and 20 / minute per client IP across all emails (`perIp` throttler: credential-stuffing cap) |
| `POST /auth/register`                   | 3 / hour per IP                                                                                                                                          |
| `POST /auth/refresh`                    | 30 / minute per IP                                                                                                                                       |
| Password reset request                  | 3 / hour per client IP + email, 10 / hour per client IP                                                                                                  |
| Accept invitation, confirm verification | 10 / hour per IP                                                                                                                                         |
| Resend verification                     | 3 / hour per IP                                                                                                                                          |

"Client IP" is the forwarded IP when the request comes through a proxy listed in `TRUST_PROXY`. The frontend calls the backend server-to-server, so without that every user would share the Next server's IP and one budget. See [13 Security](13-security.md) for the throttler setup.

## Email links: password reset, invitations, verification

- Link tokens are random, single-use, stored **hashed**, and expire: reset 30 min, verification 24 h, invitation 7 days. Issuing a new link retires older unused ones of the same kind, so only the newest works. Invitation and verification tokens live in `user_tokens` (with a `purpose`); reset tokens in `password_reset_tokens`.
- Requesting a reset always returns `202`, whether or not the email exists. A successful reset revokes every session.
- **Invited users have no password** (`passwordHash` is null) until they accept. Until then, signing in fails like a wrong password. Accepting sets the password, marks the email verified (they received the email), and signs them in.
- **Registering sends a verification email.** `/me` returns `emailVerified`; nothing is blocked while it's false (the frontend shows a reminder). Accounts created before verification existed were marked verified by the migration.
- **Every email is sent by a background job** ([15](15-background-jobs.md)): the request only queues `{ userId }`, and the processor creates the token and sends the link. Retries happen with backoff; a failure never changes the response, so it can't reveal which emails exist. Queues: `password-reset-emails` (auth), `user-emails` (users: invitations and verification).
- **Email goes through `MailService`** (`infra/mail`), picked by `MAIL_TRANSPORT`:
  - `smtp`: real delivery via nodemailer (`SMTP_URL`, `MAIL_FROM`). Works with any provider's SMTP endpoint. Timeouts: 10 s to connect, 20 s per socket.
  - `console`: prints emails, links included (development only).
  - `memory`: keeps them for tests.
  - `disabled`: drops them.

  Production only allows `smtp` or `disabled`.

- **Local inbox:** `docker compose --profile mail up -d` starts Mailpit (UI on http://localhost:8025). Then set `MAIL_TRANSPORT=smtp`, `SMTP_URL=smtp://localhost:1025`, and `MAIL_FROM`.

## Don't

- **Don't store refresh tokens, or anything else that grants access, in plain text.**
- **Don't put roles or permissions in the JWT.**
- **Don't accept `alg: none`, or let the token's header pick the algorithm.**
- **Don't log tokens, passwords, or `Authorization` headers.** The logger redacts them ([12](12-logging-and-observability.md)).
- **Don't create long-lived access tokens "for testing".** Use the seed user and log in.

## Related

[09 Authorization](09-authorization.md) · [13 Security](13-security.md) · Frontend: `docs/12-authentication.md`
