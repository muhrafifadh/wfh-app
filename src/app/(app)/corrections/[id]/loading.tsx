import { Skeleton } from "@/components/ui/skeleton";

export default function CorrectionLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading the correction request"
      className="flex flex-col gap-4"
    >
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
