import { PAGE_SIZE } from "@/config/constants";
import { filterInvoices } from "@/features/invoices/filter-invoices";
import { SAMPLE_INVOICES } from "@/features/invoices/sample-data";
import type { InvoiceFilters } from "@/features/invoices/search-params";

const defaults: InvoiceFilters = { q: "", status: null, sort: "dueDate", order: "desc", page: 1 };
const run = (filters: Partial<InvoiceFilters>) =>
  filterInvoices(SAMPLE_INVOICES, { ...defaults, ...filters });

describe("filterInvoices", () => {
  it("returns one page of everything by default, newest due date first", () => {
    const result = run({});
    expect(result.total).toBe(SAMPLE_INVOICES.length);
    expect(result.items).toHaveLength(PAGE_SIZE);
    const dueDates = result.items.map((i) => i.dueDate);
    expect(dueDates).toEqual(dueDates.toSorted().reverse());
  });

  it("searches number and customer, ignoring case", () => {
    expect(run({ q: "inv-1001" }).items.map((i) => i.number)).toEqual(["INV-1001"]);
    expect(run({ q: "ACME" }).items.every((i) => i.customer === "Acme Corp")).toBe(true);
  });

  it("filters by status", () => {
    const result = run({ status: "overdue" });
    expect(result.total).toBeGreaterThan(0);
    expect(result.items.every((i) => i.status === "overdue")).toBe(true);
  });

  it("sorts by amount in either direction", () => {
    const amounts = run({ sort: "amount", order: "asc" }).items.map((i) => i.amount);
    expect(amounts).toEqual(amounts.toSorted((a, b) => a - b));
  });

  it("clamps an out-of-range page to the last page", () => {
    const lastPage = Math.ceil(SAMPLE_INVOICES.length / PAGE_SIZE);
    expect(run({ page: 999 }).page).toBe(lastPage);
    expect(run({ page: 0 }).page).toBe(1);
  });

  it("returns nothing when no invoice matches", () => {
    expect(run({ q: "no such customer" })).toMatchObject({ items: [], total: 0, page: 1 });
  });
});
