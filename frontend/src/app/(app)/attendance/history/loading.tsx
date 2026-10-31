import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function AttendanceHistoryLoading() {
  return (
    <>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-10 w-full sm:w-48" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-20 w-full" />
      <TableSkeleton label="Loading history" />
    </>
  );
}
