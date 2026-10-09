import type { InvoiceStatus } from "@/features/invoices/constants";
import type { Invoice } from "@/features/invoices/schemas";

// Example data until the backend has invoices. Generated deterministically so
// server and client renders always agree. Delete this file when the API exists.

const CUSTOMERS = [
  ["Acme Corp", "billing@acme.test"],
  ["Globex", "accounts@globex.test"],
  ["Initech", "ap@initech.test"],
  ["Umbrella", "finance@umbrella.test"],
  ["Stark Industries", "pay@stark.test"],
  ["Wayne Enterprises", "ap@wayne.test"],
  ["Hooli", "billing@hooli.test"],
  ["Soylent", "accounts@soylent.test"],
  ["Wonka", "finance@wonka.test"],
  ["Tyrell", "ap@tyrell.test"],
  ["Cyberdyne", "billing@cyberdyne.test"],
  ["Pied Piper", "money@piedpiper.test"],
] as const;

/** "Today" for the sample data, so statuses don't change as time passes. */
export const SAMPLE_TODAY = "2026-10-01";

const DAY_MS = 86_400_000;
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function statusFor(index: number, dueDate: string): InvoiceStatus {
  if (dueDate < SAMPLE_TODAY) return index % 5 === 2 ? "overdue" : "paid";
  return index % 3 === 0 ? "draft" : "sent";
}

export const SAMPLE_INVOICES: Invoice[] = Array.from({ length: 64 }, (_, i) => {
  const [customer, email] = CUSTOMERS[(i * 7) % CUSTOMERS.length] ?? CUSTOMERS[0];
  const issued = Date.UTC(2026, 0, 5) + i * 4 * DAY_MS;
  const dueDate = isoDate(issued + 30 * DAY_MS);
  return {
    id: `inv_${String(i + 1).padStart(3, "0")}`,
    number: `INV-${1001 + i}`,
    customer,
    email,
    status: statusFor(i, dueDate),
    // Knuth multiplicative hash: spread-out amounts between $50 and $5,000.
    amount: 5_000 + (((i + 1) * 2_654_435_761) % 495_000),
    issueDate: isoDate(issued),
    dueDate,
  };
});
