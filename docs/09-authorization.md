# 09 · Authorization

**What may this caller do?** There are two checks, and **both are required**:

1. **Permission check** (on the route): does the user have `invoice:update` at all?
2. **Resource check** (in the service): is _this_ invoice one the user is allowed to access?

Skipping the second check causes **IDOR** bugs (Insecure Direct Object Reference): any signed-in user can read or change another user's data by guessing or changing an ID.

## Model

- **Organizations** keep their data separate from each other: every business record has an `organizationId`, and users belong to an organization.
- **Roles** (`owner`, `admin`, `member`, …) are stored in the database. Each role has a set of **permissions**.
- **Permissions** are `resource:action` strings, defined once in `src/common/types/auth.ts`. The frontend uses the same strings in its `can()` helper, and `GET /v1/auth/me` returns the user's permissions.

> For a single-tenant app, drop `organizationId` and scope ownership by `createdById`, or by an explicit membership table.

## Rules

- **Every non-public route has `@RequirePermissions(...)`.** A route without either `@Public()` or `@RequirePermissions` fails the boot-time check (a script that lists every route and fails the build if one has neither decorator).
- **The `PermissionsGuard` loads the user's permissions once per request**, with a short cache (60 s, cleared when roles change).
- **Services scope every query to the caller's organization.** Repository methods that read business records take `organizationId`, or the service checks it right after loading the record.
- **If the record exists but belongs to someone else, return `404`, not `403`.** Otherwise attackers can tell which IDs exist.
- **Never take `organizationId`, `userId`, or `role` from the request body** for authorization. Always use `@CurrentUser()`.
- **Rules that depend on a record's state live in the service:** for example, "only the creator can edit a draft" or "a paid invoice can't be voided". They return `409`/`422` with a specific error code.
- **Admin/support endpoints** that can see other organizations' data live in a separate `admin/` module with their own permission (`admin:access`), and every call is logged to an audit trail.

## Examples

```ts
// common/decorators/require-permissions.decorator.ts
export const PERMISSIONS_KEY = "permissions";
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
```

```ts
// common/guards/permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly users: UsersService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required?.length) return true; // public routes are handled by JwtAuthGuard

    const { user } = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    const granted = await this.users.getPermissions(user.id);
    if (!required.every((p) => granted.has(p))) throw new ForbiddenError();
    return true;
  }
}
```

```ts
// Resource check in the service, every time a record is loaded by ID
async update(user: AuthUser, id: string, dto: UpdateInvoiceDto) {
  const invoice = await this.repo.findById(id);
  if (!invoice || invoice.organizationId !== user.organizationId) throw new NotFoundError("Invoice");
  if (invoice.status !== "draft") throw new InvoiceNotEditableError(id);
  return this.repo.update(id, dto);
}
```

Guard order in `app.module.ts`: `ThrottlerGuard` → `JwtAuthGuard` → `PermissionsGuard`.

## Testing authorization

Every module's E2E tests include, for each endpoint:

- [ ] no token → `401`
- [ ] a token without the permission → `403`
- [ ] a token from **another organization** with the permission → `404`
- [ ] the right user → success

## Don't

- **Don't check roles inline** (`if (user.role === "admin")`). Check permissions.
- **Don't trust that the frontend hid the button.**
- **Don't run `findUnique({ where: { id } })` and return the result** without checking the organization.
- **Don't return `403` for records in another organization.** Return `404`.

## Related

[08 Authentication](08-authentication.md) · [03 Modules & layers](03-modules-and-layers.md) · [14 Testing](14-testing.md)
