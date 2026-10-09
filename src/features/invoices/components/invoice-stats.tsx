import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInvoiceStats } from "@/features/invoices/queries";
import { formatCents } from "@/lib/format";

export async function InvoiceStats() {
  const stats = await getInvoiceStats();
  const tiles = [
    { label: "Revenue collected", value: formatCents(stats.paidTotal), note: "Paid invoices" },
    { label: "Outstanding", value: formatCents(stats.outstandingTotal), note: "Sent and overdue" },
    { label: "Overdue", value: String(stats.overdueCount), note: "Past their due date" },
    { label: "Invoices", value: String(stats.invoiceCount), note: "All statuses" },
  ];

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => (
        <li key={tile.label}>
          <Card className="h-full">
            <CardHeader>
              <CardDescription>{tile.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">{tile.value}</CardTitle>
              <p className="text-xs text-muted-foreground">{tile.note}</p>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  );
}
