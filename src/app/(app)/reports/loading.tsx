import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-16 w-full sm:w-96" />
      <Skeleton className="h-24" />
      <Skeleton className="h-72 rounded-xl" />
      <TableSkeleton rows={5} label="Loading the report" />
    </>
  );
}
