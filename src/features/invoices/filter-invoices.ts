import { PAGE_SIZE } from "@/config/constants";
import type { Invoice } from "@/features/invoices/schemas";
import type { InvoiceFilters } from "@/features/invoices/search-params";
import type { Paginated } from "@/types/api";

/**
 * Search, filter, sort and page a list of invoices, the way the backend will.
 * Only the sample-data query uses this; it goes away with the sample data.
 */
export function filterInvoices(invoices: Invoice[], filters: InvoiceFilters): Paginated<Invoice> {
  const q = filters.q.trim().toLowerCase();
  const matches = invoices.filter(
    (invoice) =>
      (!filters.status || invoice.status === filters.status) &&
      (!q ||
        invoice.number.toLowerCase().includes(q) ||
        invoice.customer.toLowerCase().includes(q)),
  );

  const direction = filters.order === "asc" ? 1 : -1;
  const sorted = matches.toSorted((a, b) => {
    const x = a[filters.sort];
    const y = b[filters.sort];
    return (x < y ? -1 : x > y ? 1 : 0) * direction;
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), pageCount);
  const start = (page - 1) * PAGE_SIZE;

  return {
    items: sorted.slice(start, start + PAGE_SIZE),
    page,
    pageSize: PAGE_SIZE,
    total: sorted.length,
  };
}
