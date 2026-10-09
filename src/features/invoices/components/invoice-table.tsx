import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { SortHeader } from "@/components/shared/sort-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { routes } from "@/config/routes";
import { InvoiceRowActions } from "@/features/invoices/components/invoice-row-actions";
import { InvoiceStatusBadge } from "@/features/invoices/components/invoice-status-badge";
import type { InvoiceSortField } from "@/features/invoices/constants";
import { listInvoices } from "@/features/invoices/queries";
import { invoiceListHref, type InvoiceFilters } from "@/features/invoices/search-params";
import { formatCents, formatDate } from "@/lib/format";

export async function InvoiceTable({ filters }: { filters: InvoiceFilters }) {
  const result = await listInvoices(filters);
  const isFiltered = Boolean(filters.q || filters.status);
  const sortProps = (field: InvoiceSortField) => {
    const active = filters.sort === field ? filters.order : null;
    const order = active === "asc" ? "desc" : "asc";
    return { active, href: invoiceListHref({ ...filters, sort: field, order, page: 1 }) };
  };

  if (result.total === 0) {
    return isFiltered ? (
      <EmptyState
        title="No invoices match your filters"
        description="Try a different search or status."
        action={
          <Button variant="outline" asChild>
            <Link href={routes.invoices()}>Clear filters</Link>
          </Button>
        }
      />
    ) : (
      <EmptyState
        title="No invoices yet"
        description="Invoices you create show up here."
        action={
          <Button asChild>
            <Link href={routes.newInvoice()}>New invoice</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Invoice" {...sortProps("number")} />
              <SortHeader label="Customer" {...sortProps("customer")} />
              <TableHead scope="col">Status</TableHead>
              <SortHeader label="Due" {...sortProps("dueDate")} className="hidden sm:table-cell" />
              <SortHeader label="Amount" {...sortProps("amount")} className="text-right" />
              <TableHead scope="col" className="w-10">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-medium">{invoice.number}</TableCell>
                <TableCell className="whitespace-normal">
                  <span className="block">{invoice.customer}</span>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {invoice.email}
                  </span>
                </TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={invoice.status} />
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {formatDate(invoice.dueDate)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCents(invoice.amount)}
                </TableCell>
                <TableCell className="px-1">
                  <InvoiceRowActions invoice={{ id: invoice.id, number: invoice.number }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ListPagination
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
        hrefFor={(page) => invoiceListHref({ ...filters, page })}
      />
    </div>
  );
}
