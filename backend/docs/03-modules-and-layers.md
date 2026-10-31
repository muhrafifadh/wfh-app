# 03 · Modules & Layers

Each domain module has three layers, and each layer has exactly one job.

```
Controller  ──►  Service  ──►  Repository  ──►  Prisma
   HTTP          business        database
```

| Layer          | Does                                                                                                                      | Must not                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Controller** | Routing, decorators (auth, permissions, DTOs, docs), reads the current user, calls one service method, returns the result | Contain `if` business rules, touch Prisma, catch errors                                                       |
| **Service**    | Business rules, orchestration, ownership checks, transactions, calls other modules' services, emits events                | Know about HTTP (`Request`, `HttpException`, status codes), run Prisma queries itself (except `$transaction`) |
| **Repository** | Prisma queries for one aggregate, `select`/`include` shapes, mapping Prisma errors it expects                             | Contain business rules, call other repositories or services                                                   |

**Why have repositories?** They keep database code in one place, make services easy to unit-test (mock the repository, not Prisma), and leave one place to change if a query needs to be optimized or written as raw SQL.

## Rules

- **A controller method calls one service method** and returns what it gets back.
- **Services don't know about HTTP.** They throw `AppError` subclasses ([10](10-error-handling.md)), so the same service works from a controller, a job, or a CLI script.
- **Only the module's repository reads or writes its tables.** Other modules go through the service.
- **Repository methods accept an optional `tx`** so a service can run them inside a transaction ([07](07-database-and-prisma.md)).
- **A module exports only its service.** Don't export the repository or the controller.
- **Every provider is a singleton (the default scope).** Don't use `Scope.REQUEST`, because it forces everything that depends on the provider to be created again for every request. Use `nestjs-cls` for request context (request ID, current user in logs).

## Example

```ts
// invoices.controller.ts
@ApiTags("invoices")
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  @RequirePermissions("invoice:create")
  @ZodResponse({ status: 200, type: InvoiceResponse })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateInvoiceDto) {
    return this.invoices.create(user, dto);
  }

  @Get(":id")
  @RequirePermissions("invoice:read")
  @ZodResponse({ status: 200, type: InvoiceResponse })
  findOne(@CurrentUser() user: AuthUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.invoices.findOne(user, id);
  }
}
```

```ts
// invoices.service.ts
@Injectable()
export class InvoicesService {
  constructor(
    private readonly repo: InvoicesRepository,
    private readonly customers: CustomersService,
  ) {}

  async create(user: AuthUser, dto: CreateInvoiceDto): Promise<Invoice> {
    await this.customers.assertAccessible(user, dto.customerId);
    if (await this.repo.existsByNumber(user.organizationId, dto.number)) {
      throw new InvoiceNumberTakenError(dto.number);
    }
    return this.repo.insert({
      ...dto,
      organizationId: user.organizationId,
      createdById: user.id,
    });
  }

  async findOne(user: AuthUser, id: string): Promise<Invoice> {
    const invoice = await this.repo.findById(id);
    if (!invoice || invoice.organizationId !== user.organizationId)
      throw new NotFoundError("Invoice");
    return invoice;
  }
}
```

```ts
// invoices.repository.ts
@Injectable()
export class InvoicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string, tx: Tx = this.prisma) {
    return tx.invoice.findFirst({ where: { id, deletedAt: null } });
  }

  async existsByNumber(organizationId: string, number: string, tx: Tx = this.prisma) {
    return (
      (await tx.invoice.count({
        where: { organizationId, number, deletedAt: null },
      })) > 0
    );
  }

  insert(data: Prisma.InvoiceUncheckedCreateInput, tx: Tx = this.prisma) {
    return tx.invoice.create({ data });
  }
}
```

## Module file

```ts
@Module({
  imports: [CustomersModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesRepository],
  exports: [InvoicesService],
})
export class InvoicesModule {}
```

`PrismaModule`, `ConfigModule`, and the logger are `@Global()`, so feature modules don't need to import them.

## Don't

- **Don't build "fat controllers"** that load data, check rules, and build the response themselves.
- **Don't inject `Request`/`Response` into services.** Pass in the values the service needs.
- **Don't let one module's service query another module's tables** through Prisma.
- **Don't use `@Res()` in controllers** unless you're streaming. It turns off interceptors and serialization.
- **Don't make services "anemic"** by pushing the business rules up into the controller or down into the repository.

## Related

[01 Project structure](01-project-structure.md) · [07 Database & Prisma](07-database-and-prisma.md) · [10 Error handling](10-error-handling.md)
