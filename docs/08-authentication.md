# 08 · Authentication

**Who is calling?** This doc covers login and tokens. _What_ a caller is allowed to do is in [09 Authorization](09-authorization.md).

## Model

| Token             | Format                                          | Lifetime              | Stored by the backend                    | Stored by the frontend                |
| ----------------- | ----------------------------------------------- | --------------------- | ---------------------------------------- | ------------------------------------- |
| **Access token**  | JWT (HS256), claims: `sub`, `sid`, `iat`, `exp` | **15 minutes**        | Not stored                               | httpOnly cookie on the Next.js server |
| **Refresh token** | 32 random bytes, base64url                      | **30 days** (sliding) | **SHA-256 hash** in the `sessions` table | httpOnly cookie on the Next.js server |

The Next.js server is the only client that holds the tokens. It sends the access token as `Authorization: Bearer <token>` on every request, and calls `/auth/refresh` when the token expires.

## Endpoints

| Method & path              | Auth                             | Purpose                                                                  |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| `POST /v1/auth/register`   | Public                           | Create an account (if self-signup is enabled)                            |
| `POST /v1/auth/login`      | Public                           | Email + password → `{ accessToken, refreshToken, accessTokenExpiresAt }` |
| `POST /v1/auth/refresh`    | Public (needs the refresh token) | Exchange the refresh token for a **new pair of tokens**                  |
| `POST /v1/auth/logout`     | Bearer                           | End the current session                                                  |
| `POST /v1/auth/logout-all` | Bearer                           | End all of this user's sessions                                          |
| `GET /v1/auth/me`          | Bearer                           | Current user + `permissions[]`. The frontend's `getSession()` calls this |

## Rules

### Passwords

- **Hash passwords with Argon2id** (`argon2` package, default settings or stronger). Never use bcrypt with a low cost factor, SHA, or MD5.
- **Passwords must be at least 12 characters**, with no rules about which kinds of characters to include. Reject passwords that appear in known breaches (k-anonymity check against HaveIBeenPwned) when the user registers or changes their password.
- **When login fails, return the same error and take the same time** whether or not the email exists: `401 INVALID_CREDENTIALS`. If the user isn't found, verify the password against a dummy hash anyway, so response timing doesn't reveal which emails are registered.

### Access tokens

- **Sign with `JWT_ACCESS_SECRET`** (at least 32 random bytes) using `@nestjs/jwt`. Verify the algorithm, `exp`, `iss`, and `aud` on every request.
- **The token contains only `sub` (user ID) and `sid` (session ID).** Don't put permissions or personal data in it. Permissions are loaded on each request ([09](09-authorization.md)), so a change takes effect right away instead of after the token expires.
- **Revoked sessions are not checked against the database on each request.** That's acceptable because access tokens only live for 15 minutes. For sensitive actions (changing password or email, deleting the account), the endpoint also checks that the session is still active.

### Refresh tokens & sessions

- **Store only the hash.** The raw token is returned once and never logged.
- **Issue a new refresh token every time one is used.** Each `/auth/refresh` call invalidates the old token and returns a new one.
- **Detect reuse:** if someone presents a refresh token that was already used, **revoke every session that descends from it** and return `401`. This means the token was stolen.
- **A session records** `userId`, `refreshTokenHash`, `expiresAt`, `lastUsedAt`, `userAgent`, `ip`, and `revokedAt`.
- **Changing your password revokes every other session.**
- **A scheduled job removes sessions** that expired or were revoked more than 30 days ago.

### Guards & decorators

- **`JwtAuthGuard` is global** (`APP_GUARD`). **Every route requires a valid token by default.**
- **Use `@Public()` to make a route public.** Every `@Public()` gets extra attention in review.
- **Read the current user with `@CurrentUser()`.** It returns `AuthUser` (`{ id, sessionId, organizationId }`). Never read `req.user` directly.

```ts
// common/guards/jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const token = extractBearer(req);
    if (!token) throw new UnauthenticatedError();

    const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token).catch((e: unknown) => {
      throw e instanceof TokenExpiredError
        ? new TokenExpiredAppError()
        : new UnauthenticatedError();
    });

    req.user = await this.users.getAuthUser(payload.sub, payload.sid); // throws if the user is disabled
    return true;
  }
}
```

### Rate limits

| Endpoint               | Limit                                   |
| ---------------------- | --------------------------------------- |
| `POST /auth/login`     | 5 / minute per IP + email, then backoff |
| `POST /auth/register`  | 3 / hour per IP                         |
| `POST /auth/refresh`   | 30 / minute per IP                      |
| Password reset request | 3 / hour per email                      |

See [13 Security](13-security.md) for the throttler setup.

## Password reset & email verification

- Reset and verification tokens are random, single-use, stored **hashed**, and expire (reset: 30 min, verification: 24 h).
- Requesting a reset always returns `202`, whether or not the email exists.
- A successful reset revokes every session.

## Don't

- **Don't store refresh tokens, or anything else that grants access, in plain text.**
- **Don't put roles or permissions in the JWT.**
- **Don't accept `alg: none`, or let the token's header pick the algorithm.**
- **Don't log tokens, passwords, or `Authorization` headers.** The logger redacts them ([12](12-logging-and-observability.md)).
- **Don't create long-lived access tokens "for testing".** Use the seed user and log in.

## Related

[09 Authorization](09-authorization.md) · [13 Security](13-security.md) · Frontend: `docs/12-authentication.md`
