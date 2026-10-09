import { Skeleton } from "@/components/ui/skeleton";
import {
  InvoiceFiltersSkeleton,
  InvoiceTableSkeleton,
} from "@/features/invoices/components/invoice-table-skeleton";

export default function InvoicesLoading() {
  return (
    <>
      <Skeleton className="h-8 w-40" />
      <InvoiceFiltersSkeleton />
      <InvoiceTableSkeleton />
    </>
  );
}
