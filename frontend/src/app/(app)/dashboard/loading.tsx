import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-44" />
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
