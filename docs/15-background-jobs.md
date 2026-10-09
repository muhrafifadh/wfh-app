# 15 · Background Jobs & Events

Anything slow, unreliable, or not needed for the response happens outside the request: sending emails, generating PDFs, calling third-party APIs, webhooks, and cleanup.

## Stack

| Need                                  | Tool                                        |
| ------------------------------------- | ------------------------------------------- |
| Durable jobs with retries             | **BullMQ** (`@nestjs/bullmq`) on Redis      |
| Recurring / scheduled jobs            | BullMQ **job schedulers** (repeatable jobs) |
| Decoupling modules within one process | `@nestjs/event-emitter`                     |

## Rules

### Jobs

- **Each module owns its queues and processors**, in `modules/<m>/jobs/`. A queue is named after what it does: `invoice-emails`, `pdf-render`.
- **Job data is small and serializable:** IDs, not whole records. The processor loads fresh data when it runs.
- **Processors parse `job.data` with a Zod schema** before using it ([04](04-typescript.md)).
- **Every job can safely run more than once.** Jobs get retried, so running the same job twice must have the same effect as running it once. Use a `jobId` derived from the business key (`invoice-sent:${invoiceId}`) so the same job isn't queued twice. Check the current state before acting ("already sent? stop").
- **Retry with backoff:** `attempts: 5`, exponential backoff starting at 10 s. After the last attempt, log at `error` and keep the failed job for inspection (`removeOnFail: { age: 7 days }`).
- **Processors call services, not repositories.** The business rules are the same whether a request or a job triggers them ([03](03-modules-and-layers.md)).
- **Set concurrency on purpose** for each processor, taking into account rate limits of third-party APIs.
- **Use BullMQ job schedulers for scheduled jobs, not `@nestjs/schedule` cron.** With cron, every app instance would run the job.

### Consistency: enqueue after commit

If a database change and a job have to happen together, never enqueue the job _inside_ the transaction. If the transaction rolls back, the job still runs. If the queue is down, the request fails even though the data was fine.

- **Simple case:** enqueue the job **after** the transaction commits. Accept the small risk that the job is lost if the process crashes in between, or have a scheduled job that finds and repairs missed work.
- **When a lost job isn't acceptable** (payments, external notifications users rely on): use an **outbox** table. Write an `outbox_events` row in the same transaction, and have a dispatcher job that publishes pending rows and marks them done.

### In-process events

- **Use events so a module can react to another without depending on it**, e.g. `invoice.paid` → the notifications module sends a receipt.
- **Event names are `<entity>.<past-tense-verb>`** (`invoice.paid`), and each event has a typed payload class in the module that emits it.
- **Event handlers that do slow or unreliable work only enqueue a job.** In-process events aren't durable: if the process crashes, they're lost.

## Example

```ts
// modules/invoices/jobs/send-invoice.processor.ts
export const SEND_INVOICE_QUEUE = "invoice-emails";
const sendInvoiceJobSchema = z.object({ invoiceId: z.uuid() });

@Processor(SEND_INVOICE_QUEUE, { concurrency: 5 })
export class SendInvoiceProcessor extends WorkerHost {
  constructor(
    private readonly invoices: InvoicesService,
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { invoiceId } = sendInvoiceJobSchema.parse(job.data);
    await this.invoices.deliver(invoiceId); // safe to repeat: does nothing if already delivered
    this.logger.info({ invoiceId, jobId: job.id }, "Invoice delivered");
  }
}
```

```ts
// enqueue after the write has committed
const invoice = await this.repo.update(id, { status: "sent" });
await this.queue.add("send", { invoiceId: id }, { jobId: `invoice-sent:${id}` });
return invoice;
```

## Don't

- **Don't send emails or call third-party APIs inside the request** when the response doesn't need the result.
- **Don't put whole records, tokens, or secrets in job data.** Job data is stored in Redis as plain text.
- **Don't write jobs that break when retried** (sending twice, charging twice).
- **Don't use `setTimeout`, unawaited promises, or `@nestjs/schedule` intervals** for background work. That work is lost when the app restarts, and it runs on every instance.

## Related

[03 Modules & layers](03-modules-and-layers.md) · [07 Database & Prisma](07-database-and-prisma.md) · [12 Logging & observability](12-logging-and-observability.md)
