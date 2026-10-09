# 05 · API Design

This doc is the **contract with `frontend-boilerplate`**. Changing anything here is a breaking change for the frontend, unless the change only adds something.

## URLs & methods

- **All routes are under the global prefix `/v1`.** Breaking changes go to `/v2` for the affected routes. Never break `/v1` in place.
- **Use plural nouns in `kebab-case`:** `/v1/invoices`, `/v1/team-members`.
- **Nest routes at most one level deep:** `/v1/invoices/:id/lines`. For anything deeper, use top-level routes with filters (`/v1/payments?invoiceId=…`).
- **For actions that aren't create/read/update/delete, use a verb sub-resource with `POST`:** `POST /v1/invoices/:id/send`, `POST /v1/invoices/:id/void`.

| Operation      | Method & path                | Success                                                  |
| -------------- | ---------------------------- | -------------------------------------------------------- |
| List           | `GET /v1/invoices`           | `200` + `Paginated<T>`                                   |
| Get one        | `GET /v1/invoices/:id`       | `200` + resource                                         |
| Create         | `POST /v1/invoices`          | `201` + created resource                                 |
| Partial update | `PATCH /v1/invoices/:id`     | `200` + updated resource                                 |
| Delete         | `DELETE /v1/invoices/:id`    | `204`, empty body                                        |
| Action         | `POST /v1/invoices/:id/send` | `200` + updated resource, or `202` if the work is queued |

Don't use `PUT`. Updates are partial (`PATCH`).

## Request & response format

- **JSON only, with `camelCase` keys.**
- **Successful responses return the resource itself, with no `{ data: … }` wrapper.** The frontend parses the response body directly with Zod.
- **IDs are UUID strings** (UUIDv7, which sorts by creation time).
- **Dates are ISO-8601 strings in UTC:** `2026-10-08T09:30:00.000Z`. Date-only fields use `YYYY-MM-DD`.
- **Money is sent as an integer number of minor units** (e.g. cents) plus an ISO-4217 `currency` code: `{ "amount": 125000, "currency": "IDR" }`. Never send money as a float.
- **Optional values that aren't set are `null`, not missing**, so the response shape is always the same.
- **Responses never include internal fields** (`passwordHash`, `deletedAt`, internal flags). The response DTO enforces this ([06](06-validation-and-dtos.md)).

## Lists: pagination, filtering, sorting

**Query params:**

| Param      | Example                    | Rules                                                                               |
| ---------- | -------------------------- | ----------------------------------------------------------------------------------- |
| `page`     | `1`                        | Starts at 1. Default 1                                                              |
| `pageSize` | `20`                       | Default 20, max 100                                                                 |
| `q`        | `acme`                     | Free-text search, if the endpoint supports it                                       |
| `sort`     | `-createdAt`               | A field name; a `-` prefix means descending. Only allowed fields                    |
| Filters    | `status=paid&customerId=…` | Named after fields. Repeat the param for multiple values: `status=sent&status=paid` |

**Response:**

```json
{
  "items": [{ "id": "…", "number": "INV-1001" }],
  "page": 1,
  "pageSize": 20,
  "total": 134
}
```

For feeds or very large tables where counting all rows is expensive, use cursor pagination instead: `?cursor=…&limit=…` → `{ items, nextCursor }`. Document it on that endpoint.

## Errors

Every error has the same body ([10](10-error-handling.md)):

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Some fields are invalid.",
    "details": {
      "fieldErrors": { "amount": ["Amount must be greater than 0"] }
    },
    "requestId": "01J9Z6…"
  }
}
```

| Status | When                                                                             | `code` examples                                |
| ------ | -------------------------------------------------------------------------------- | ---------------------------------------------- |
| `400`  | The input failed validation                                                      | `VALIDATION_FAILED`                            |
| `401`  | Missing, invalid, or expired token                                               | `UNAUTHENTICATED`, `TOKEN_EXPIRED`             |
| `403`  | Signed in, but missing the permission                                            | `FORBIDDEN`                                    |
| `404`  | Doesn't exist, **or** the user isn't allowed to know it exists                   | `NOT_FOUND`                                    |
| `409`  | Conflicts with the current state (duplicate value, wrong status for this action) | `INVOICE_NUMBER_TAKEN`, `INVOICE_ALREADY_PAID` |
| `413`  | The request body is too large                                                    | `PAYLOAD_TOO_LARGE`                            |
| `422`  | Valid input, but a business rule rejects it                                      | `DUE_DATE_IN_PAST`                             |
| `429`  | Rate limited                                                                     | `RATE_LIMITED`                                 |
| `500`  | Unexpected error                                                                 | `INTERNAL_ERROR`                               |

The frontend uses `code` to decide what to do, and `message` to show the user. **Codes never change once released.** Messages can be reworded.

## Documentation & the contract file

- **OpenAPI is generated** from controllers and Zod DTOs, served at `/docs` outside production, and **committed as `openapi.json`**.
- **`openapi.json` is the contract.** The frontend generates its TypeScript types from it, and its type check fails when its Zod schemas don't match.
- **After any API change, run `pnpm openapi` and commit the result.** CI regenerates the file and fails if it differs from the committed one.
- **Document every response with `@ZodResponse({ status, type })`.** It filters the response, puts its shape in the spec, and type-checks the handler's return value. Don't use `@ZodSerializerDto`: it skips the spec.
- **Every endpoint has `@ApiTags` and documented error responses** (`@ApiNotFoundResponse()`, …). The shared error body is the `ErrorResponse` schema.
- If you change the contract, say so in the PR description and link the matching frontend PR.

## Don't

- **Don't return `200` with `{ success: false }`.** Use the right status code.
- **Don't put verbs in resource paths** (`/getInvoices`, `/createInvoice`).
- **Don't return arrays without pagination** from list endpoints. Even small lists grow.
- **Don't expose auto-increment IDs or other internal identifiers.**
- **Don't change a response shape in place.** Add new fields (non-breaking), or version the route.

## Related

[06 Validation & DTOs](06-validation-and-dtos.md) · [10 Error handling](10-error-handling.md) · [09 Authorization](09-authorization.md)
