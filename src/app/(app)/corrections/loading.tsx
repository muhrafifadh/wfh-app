import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function CorrectionsLoading() {
  return (
    <>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full sm:w-80" />
      <TableSkeleton rows={3} label="Loading corrections" />
    </>
  );
}
