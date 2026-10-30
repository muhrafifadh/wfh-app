import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamMemberLoading() {
  return (
    <>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-72" />
      <TableSkeleton rows={6} label="Loading attendance" />
    </>
  );
}
