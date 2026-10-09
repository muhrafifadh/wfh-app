import { z } from "zod";

import { INVOICE_STATUSES, NEW_INVOICE_STATUSES } from "@/features/invoices/constants";

export const invoiceSchema = z.object({
  id: z.string(),
  number: z.string(),
  customer: z.string(),
  email: z.email(),
  status: z.enum(INVOICE_STATUSES),
  amount: z.int(), // minor units (cents), see backend docs/05-api-design.md
  issueDate: z.iso.date(),
  dueDate: z.iso.date(),
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const createInvoiceSchema = z.object({
  customer: z
    .string()
    .trim()
    .min(1, "Enter the customer's name")
    .max(100, "Use at most 100 characters"),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email")),
  // The input is text; the action gets cents.
  amount: z
    .string()
    .trim()
    .min(1, "Enter an amount")
    .pipe(
      z.coerce
        .number<string>("Enter an amount")
        .positive("Amount must be greater than 0")
        .max(1_000_000, "Amount must be at most 1,000,000")
        .transform((dollars) => Math.round(dollars * 100)),
    ),
  dueDate: z.iso.date("Choose a due date"),
  status: z.enum(NEW_INVOICE_STATUSES, "Choose a status"),
  notes: z.string().trim().max(500, "Use at most 500 characters"),
  emailCopy: z.boolean(),
});
export type CreateInvoiceFormValues = z.input<typeof createInvoiceSchema>;
export type CreateInvoiceInput = z.output<typeof createInvoiceSchema>;

export const deleteInvoiceSchema = invoiceSchema.pick({ id: true, number: true });
