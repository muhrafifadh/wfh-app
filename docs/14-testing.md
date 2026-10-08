# 14 · Testing

## What to test, with what

| Layer | Tool | Test | Location |
|---|---|---|---|
| Unit | **Vitest** | `lib/` helpers, schemas, hooks, store logic | `*.test.ts` next to the source file |
| Component | **Vitest + Testing Library** | What a Client Component shows and does when used | `*.test.tsx` next to the source file |
| End-to-end | **Playwright** | The critical flows (below), against a running app | `e2e/*.spec.ts` |

Async Server Components can't be unit-tested well. Cover them with E2E tests, and unit-test the `queries.ts` / `actions.ts` functions they call.

**Critical flows that must have E2E coverage:** sign in and sign out, a protected route redirecting to login, and the main create/edit/delete flow of every feature.

## Rules

- **Test behavior, not implementation details.** Write assertions about what the user sees and can do, not about internal state or how many times a hook ran.
- **Find elements the way users do:** `getByRole` → `getByLabelText` → `getByText`. Use `data-testid` only when nothing else works.
- **Simulate interactions with `userEvent`**, not `fireEvent`.
- **Mock the network with MSW** at the HTTP level. Don't mock `fetch` or internal modules by hand. Mock modules only at system boundaries (`next/navigation`, time, randomness).
- **Every bug fix comes with a test** that fails without the fix.
- **Every Server Action has tests** for: unauthenticated → rejected, invalid input → `fieldErrors`, success → expected backend call and revalidation.
- **Every Zod schema with custom rules has tests** for the edge cases (empty, too long, wrong type, values right at each limit).
- **Tests are independent of each other.** No shared state that changes, and no depending on the order tests run in. Reset MSW handlers and stores in `afterEach`.
- **Test names describe behavior:** `it("shows an error when the amount is negative")`, not `it("works")`.
- **Coverage isn't a target**, but CI fails if coverage of the changed files drops.

## Examples

**Component test:**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CreateInvoiceForm } from "./create-invoice-form";

it("shows a validation error when the amount is not positive", async () => {
  const user = userEvent.setup();
  render(<CreateInvoiceForm />);

  await user.type(screen.getByLabelText(/amount/i), "-5");
  await user.click(screen.getByRole("button", { name: /create invoice/i }));

  expect(await screen.findByText(/amount must be greater than 0/i)).toBeInTheDocument();
});
```

**E2E test:**

```ts
// e2e/create-invoice.spec.ts
import { test, expect } from "@playwright/test";

test("user can create an invoice", async ({ page }) => {
  await page.goto("/invoices/new");
  await page.getByLabel("Invoice number").fill("INV-1001");
  // …
  await page.getByRole("button", { name: "Create invoice" }).click();

  await expect(page).toHaveURL(/\/invoices\/[\w-]+$/);
  await expect(page.getByRole("heading", { name: "INV-1001" })).toBeVisible();
});
```

- E2E tests sign in once through a setup project, save the browser state (`storageState`), and reuse it in every test. Don't sign in through the UI in every test.
- E2E tests run against seeded test data, never against shared or production data.

## Don't

- **Don't take snapshots of whole components.** Nobody reads the diffs, so they break all the time and catch nothing.
- **Don't test shadcn primitives or third-party libraries.** Test your own code.
- **Don't use `waitFor(() => …, { timeout: 5000 })` or `sleep` to fix flaky tests.** Use `findBy*` or wait for a specific state.
- **Don't merge a test with `it.only`, `it.skip`, or `test.fixme`** unless an issue linked in a comment explains why.

## Related

[18 Tooling & Git](18-tooling-and-git.md) · [09 Server Actions](09-server-actions.md)
