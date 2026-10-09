import "server-only";

import { cache } from "react";

import { filterInvoices } from "@/features/invoices/filter-invoices";
import { SAMPLE_INVOICES } from "@/features/invoices/sample-data";
import type { Invoice } from "@/features/invoices/schemas";
import type { InvoiceFilters } from "@/features/invoices/search-params";
import type { Paginated } from "@/types/api";

// docs/08-data-fetching.md — these read sample data for now. When the backend has
// invoices, swap each body for apiFetch("/invoices…", { schema }) and keep the signatures.

export const listInvoices = cache(async (filters: InvoiceFilters): Promise<Paginated<Invoice>> =>
  filterInvoices(SAMPLE_INVOICES, filters),
);

export type InvoiceStats = {
  paidTotal: number;
  outstandingTotal: number;
  overdueCount: number;
  invoiceCount: number;
};

export const getInvoiceStats = cache(async (): Promise<InvoiceStats> => {
  const sum = (invoices: Invoice[]) => invoices.reduce((total, i) => total + i.amount, 0);
  const paid = SAMPLE_INVOICES.filter((i) => i.status === "paid");
  const open = SAMPLE_INVOICES.filter((i) => i.status === "sent" || i.status === "overdue");
  return {
    paidTotal: sum(paid),
    outstandingTotal: sum(open),
    overdueCount: SAMPLE_INVOICES.filter((i) => i.status === "overdue").length,
    invoiceCount: SAMPLE_INVOICES.length,
  };
});

export type MonthlyRevenue = { month: string; amount: number };

/** Paid invoice totals per month of issue, in cents. */
export const getMonthlyRevenue = cache(async (): Promise<MonthlyRevenue[]> => {
  const byMonth = new Map<string, number>();
  for (const invoice of SAMPLE_INVOICES) {
    if (invoice.status !== "paid") continue;
    const month = invoice.issueDate.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + invoice.amount);
  }
  return [...byMonth].map(([month, amount]) => ({ month, amount }));
});
