import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function HolidaysLoading() {
  return (
    <>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-9 w-48" />
      <TableSkeleton rows={4} label="Loading holidays" />
    </>
  );
}
