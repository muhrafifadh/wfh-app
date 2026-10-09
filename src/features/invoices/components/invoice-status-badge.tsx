import { Badge } from "@/components/ui/badge";
import type { InvoiceStatus } from "@/features/invoices/constants";

const STATUS_VARIANT = {
  draft: "secondary",
  sent: "outline",
  paid: "default",
  overdue: "destructive",
} as const satisfies Record<InvoiceStatus, React.ComponentProps<typeof Badge>["variant"]>;

const STATUS_LABEL = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
} as const satisfies Record<InvoiceStatus, string>;

/** Status as a word, not only a color (docs/15-accessibility.md). */
export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function invoiceStatusLabel(status: InvoiceStatus) {
  return STATUS_LABEL[status];
}
