import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-9 w-full sm:max-w-xs" />
      <TableSkeleton label="Loading" />
    </>
  );
}
