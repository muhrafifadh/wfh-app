# 14 · Testing

## What to test, with what

| Layer             | Tool                                   | What                                                                            | Location                       |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------ |
| Unit              | **Vitest**                             | Service business rules (repositories mocked), pure helpers, Zod schemas, guards | `*.spec.ts` next to the source |
| E2E / integration | **Vitest + Supertest + real Postgres** | HTTP → controller → service → repository → database, including auth and errors  | `test/*.e2e-spec.ts`           |

Repositories are covered by E2E tests against a real database, not by unit tests with a mocked Prisma. Mocking Prisma only tests that the mock returns what you told it to.

## Rules

### General

- **Every bug fix comes with a test** that fails without the fix.
- **Test names describe behavior:** `it("rejects voiding a paid invoice")`.
- **Tests are independent of each other.** They don't depend on the order they run in, and nothing they share is modified.
- **Coverage isn't a goal in itself**, but CI fails if coverage of changed files drops. Every service method's business-rule branches must be covered.

### Unit tests

- **Build services with `Test.createTestingModule`** and mock their dependencies (repository, other services) with `vitest-mock-extended`'s `mock<T>()`.
- **Test business rules, not delegation.** "Calls `repo.insert`" alone isn't a useful test. "Throws `InvoiceNumberTakenError` when the number exists" is.

### E2E tests

- **Run against a real PostgreSQL** (`docker compose up -d postgres-test`, or a service container in CI). `pnpm test:e2e` applies migrations to it first, using the committed `.env.test`.
- **Build the test app with `configureApp(app)`** (`src/configure-app.ts`), the same function `main.ts` uses. See `test/app.e2e-spec.ts`. Then the tests run with the same global pipes, filters, prefix, and guards as production.
- **Clean up between tests:** truncate all tables except `_prisma_migrations` in `beforeEach`.
- **Create test data with factories** (`test/factories/`), never with the dev seed: `await createUser({ permissions: ["invoice:create"] })`.
- **Get tokens with a helper** that signs a real JWT for a factory user (`authHeader(user)`). Don't call `/auth/login` in every test.
- **Every endpoint has the authorization matrix:** 401 / 403 / other-organization 404 / success ([09](09-authorization.md)).
- **Every endpoint has a validation test** that checks the `400 VALIDATION_FAILED` body shape.
- **Jobs run for real** (Redis from `redis-test`). After a request that queues a job, `await waitForJobs(app)` before checking its effect (an email in the `MemoryMailer`, a row). Each test app gets its own `QUEUE_PREFIX`, so a job left over from one test never runs in the next.
- **Uploads hit real storage** (the `storage` container), through the signed URLs, like a browser would.

## Examples

**Unit:**

```ts
describe("InvoicesService.create", () => {
  const repo = mock<InvoicesRepository>();
  const customers = mock<CustomersService>();
  let service: InvoicesService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new InvoicesService(repo, customers);
  });

  it("rejects a duplicate invoice number", async () => {
    repo.existsByNumber.mockResolvedValue(true);

    await expect(
      service.create(aUser(), aCreateInvoiceDto({ number: "INV-1" })),
    ).rejects.toBeInstanceOf(InvoiceNumberTakenError);
    expect(repo.insert).not.toHaveBeenCalled();
  });
});
```

**E2E:**

```ts
describe("POST /v1/invoices", () => {
  it("creates an invoice", async () => {
    const user = await createUser({ permissions: ["invoice:create"] });
    const customer = await createCustomer({
      organizationId: user.organizationId,
    });

    const res = await request(app.getHttpServer())
      .post("/v1/invoices")
      .set(authHeader(user))
      .send({
        number: "INV-1",
        customerId: customer.id,
        amount: 125000,
        currency: "IDR",
        dueDate: "2026-12-01",
      })
      .expect(201);

    expect(res.body).toMatchObject({ number: "INV-1", status: "draft" });
    expect(res.body).not.toHaveProperty("organizationId");
  });

  it("returns 404 for a customer in another organization", async () => {
    const user = await createUser({ permissions: ["invoice:create"] });
    const foreign = await createCustomer(); // a different organization

    await request(app.getHttpServer())
      .post("/v1/invoices")
      .set(authHeader(user))
      .send({
        number: "INV-1",
        customerId: foreign.id,
        amount: 1,
        currency: "IDR",
        dueDate: "2026-12-01",
      })
      .expect(404);
  });
});
```

## Don't

- **Don't mock `PrismaService` to test repositories.**
- **Don't share one database row between tests.**
- **Don't use `setTimeout` or `sleep`.** Use fake timers (`vi.useFakeTimers()`), or wait for the specific condition.
- **Don't run tests against the dev database.** The test database is separate, so a truncate can never wipe real work.
- **Don't merge `.only` or `.skip`** unless an issue linked in a comment explains why.

## Related

[09 Authorization](09-authorization.md) · [16 Tooling & Git](16-tooling-and-git.md)
