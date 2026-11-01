import { TableSkeleton } from "@/components/shared/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationsLoading() {
  return (
    <>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full sm:w-44" />
      <TableSkeleton rows={4} label="Loading notifications" />
    </>
  );
}
