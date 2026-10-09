export const INVOICE_STATUSES = ["draft", "sent", "paid", "overdue"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** A new invoice is either kept as a draft or sent straight away. */
export const NEW_INVOICE_STATUSES = ["draft", "sent"] as const;

export const INVOICE_SORT_FIELDS = ["number", "customer", "amount", "dueDate"] as const;
export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number];

export const SORT_ORDERS = ["asc", "desc"] as const;
