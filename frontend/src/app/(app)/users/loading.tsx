import { Skeleton } from "@/components/ui/skeleton";
import {
  UserFiltersSkeleton,
  UserTableSkeleton,
} from "@/features/users/components/user-table-skeleton";

export default function UsersLoading() {
  return (
    <>
      <Skeleton className="h-8 w-32" />
      <UserFiltersSkeleton />
      <UserTableSkeleton />
    </>
  );
}
