import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the user page. Its own boundary: navigating from /users to here stays instant. */
export default function UserLoading() {
  return (
    <div aria-busy="true" aria-label="Loading user" className="flex flex-col gap-4">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}
