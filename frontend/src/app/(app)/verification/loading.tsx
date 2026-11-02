import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function VerificationReviewLoading() {
  return (
    <div aria-busy="true" aria-label="Loading results" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <TableSkeleton label="Loading results" />
    </div>
  );
}
