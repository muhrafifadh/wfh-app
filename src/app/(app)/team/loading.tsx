import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamLoading() {
  return (
    <>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-16 w-60" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <TableSkeleton rows={5} label="Loading your team" />
    </>
  );
}
