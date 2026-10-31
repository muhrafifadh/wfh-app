import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function CorrectionReviewLoading() {
  return (
    <>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-10 w-full sm:w-96" />
      <TableSkeleton rows={4} label="Loading requests" />
    </>
  );
}
