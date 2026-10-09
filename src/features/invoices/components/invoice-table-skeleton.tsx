import { Skeleton } from "@/components/ui/skeleton";

const ROWS = 8;

export function InvoiceTableSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading invoices" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border p-3">
        <Skeleton className="h-5 w-full" />
        {Array.from({ length: ROWS }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-40" />
      </div>
    </div>
  );
}

export function InvoiceFiltersSkeleton() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Skeleton className="h-9 w-full sm:max-w-xs" />
      <Skeleton className="h-9 w-full sm:w-40" />
    </div>
  );
}
