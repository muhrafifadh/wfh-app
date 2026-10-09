import {
  createLoader,
  createSerializer,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs/server";

import { routes } from "@/config/routes";
import { INVOICE_SORT_FIELDS, INVOICE_STATUSES, SORT_ORDERS } from "@/features/invoices/constants";

// docs/11-state-and-url-params.md — the one definition of the invoice list's URL.
export const invoiceSearchParams = {
  q: parseAsString.withDefault(""),
  status: parseAsStringLiteral(INVOICE_STATUSES),
  sort: parseAsStringLiteral(INVOICE_SORT_FIELDS).withDefault("dueDate"),
  order: parseAsStringLiteral(SORT_ORDERS).withDefault("desc"),
  page: parseAsInteger.withDefault(1),
};

export const loadInvoiceSearchParams = createLoader(invoiceSearchParams);
export type InvoiceFilters = inferParserType<typeof invoiceSearchParams>;

const serialize = createSerializer(invoiceSearchParams);

/** A link to the invoice list with these filters. Defaults are left out of the URL. */
export const invoiceListHref = (filters: Partial<InvoiceFilters>) =>
  serialize(routes.invoices(), filters);
