import { Skeleton } from "@/components/ui/skeleton";

// UX_FLOWS.md §7.2 A: the card's shape, and no button until eligibility is known.
export default function AttendanceLoading() {
  return (
    <div aria-busy="true" aria-label="Loading today's attendance" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      <div className="flex max-w-2xl flex-col gap-3 rounded-xl border p-6">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-11 w-48" />
      </div>
    </div>
  );
}
