# 03 · TypeScript

## Rules

- **`strict: true` and `noUncheckedIndexedAccess: true` are on.** Don't turn them off for a file or folder.
- **Don't use `any`.** Use `unknown` and narrow it. If `any` is truly unavoidable (a broken third-party type), disable the lint rule for that one line and explain why in a comment.
- **Don't use `!` (non-null assertion)** unless a comment on the same line explains why the value can't be null.
- **Use `@ts-expect-error` with a reason, never `@ts-ignore`.** `@ts-expect-error` warns you when the error goes away, so it can't stay in the code after it's no longer needed.
- **Validate data at the edges of the app.** Anything that comes from outside the code is `unknown` until Zod parses it: API responses, form data, search params, env vars, `localStorage`, `postMessage`. TypeScript only checks types at compile time.
- **Derive types instead of writing them twice:**
  - `z.infer<typeof schema>` for schema-backed data
  - `React.ComponentProps<typeof Button>` / `React.ComponentProps<"button">` for props
  - `Awaited<ReturnType<typeof getInvoice>>` for query results
  - `(typeof STATUSES)[number]` for unions built from constants
- **Use `type` by default.** Use `interface` only when you need declaration merging (e.g. augmenting a library's types).
- **Use string-literal unions or `as const` objects instead of `enum`.**
- **Exported functions in `lib/` and `features/*/actions.ts` / `queries.ts` declare their return type**, so internal changes can't silently change what they return.

## Where types live

| Type                                                 | Location                                        |
| ---------------------------------------------------- | ----------------------------------------------- |
| Inferred from a schema                               | next to the schema in `features/<f>/schemas.ts` |
| Domain types for one feature                         | `features/<f>/types.ts`                         |
| Shared by 2+ features (`User`, `Paginated<T>`, `ID`) | `src/types/`                                    |
| Component props                                      | in the component file, just above the component |

## Examples

**Use discriminated unions instead of several boolean flags:**

```ts
// ✅
type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "error"; message: string }
  | { status: "done"; url: string };

// ❌ allows impossible states like isLoading && isError at the same time
type UploadState = { isLoading: boolean; isError: boolean; url?: string; progress?: number };
```

**Use constants as the single source of truth for unions:**

```ts
export const INVOICE_STATUSES = ["draft", "sent", "paid", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const invoiceStatusSchema = z.enum(INVOICE_STATUSES);
```

**Shared generic types:**

```ts
// src/types/api.ts
export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};
```

**Narrow `unknown` instead of casting it:**

```ts
// ✅
const result = invoiceSchema.safeParse(json);
if (!result.success) throw new ApiError("Invalid invoice payload", 502);

// ❌ the cast tells TypeScript the shape is right without checking anything
const invoice = json as Invoice;
```

## Don't

- **Don't use `as SomeType` to quiet an error.** Casting is only acceptable right after code that actually checks the shape, or for `as const`.
- **Don't write `Function`, `Object`, or `{}` as types.** They're almost as loose as `any`. Write the actual signature or shape.
- **Don't keep a hand-written copy of a backend type.** Infer it from the response schema so the type and the runtime check stay in sync.
- **Don't export types you don't need to share.** Keep them private to the file.

## Related

[10 Validation & forms](10-validation-and-forms.md) · [08 Data fetching](08-data-fetching.md)
