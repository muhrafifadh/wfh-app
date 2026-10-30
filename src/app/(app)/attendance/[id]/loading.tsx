import { Skeleton } from "@/components/ui/skeleton";

export default function AttendanceRecordLoading() {
  return (
    <div aria-busy="true" aria-label="Loading attendance record" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
