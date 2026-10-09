import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { InvoiceFilters } from "@/features/invoices/components/invoice-filters";
import { InvoiceTable } from "@/features/invoices/components/invoice-table";
import {
  InvoiceFiltersSkeleton,
  InvoiceTableSkeleton,
} from "@/features/invoices/components/invoice-table-skeleton";
import { loadInvoiceSearchParams } from "@/features/invoices/search-params";

export const metadata: Metadata = { title: "Invoices" };

export default function InvoicesPage({ searchParams }: PageProps<"/invoices">) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <Badge variant="secondary">Example data</Badge>
        <Button asChild className="ml-auto">
          <Link href={routes.newInvoice()}>
            <PlusIcon aria-hidden />
            New invoice
          </Link>
        </Button>
      </div>
      <Suspense fallback={<InvoiceFiltersSkeleton />}>
        <InvoiceFilters />
      </Suspense>
      <Suspense fallback={<InvoiceTableSkeleton />}>
        <InvoiceResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function InvoiceResults({ searchParams }: Pick<PageProps<"/invoices">, "searchParams">) {
  const filters = await loadInvoiceSearchParams(searchParams);
  return <InvoiceTable filters={filters} />;
}
