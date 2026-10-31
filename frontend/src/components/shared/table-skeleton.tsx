import { Skeleton } from "@/components/ui/skeleton";

/** A list page's table and pagination while loading. */
export function TableSkeleton({ rows = 6, label }: { rows?: number; label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-lg border p-3">
        <Skeleton className="h-5 w-full" />
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
      <div className="flex justify-between">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-8 w-40" />
      </div>
    </div>
  );
}
