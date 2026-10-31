import { Skeleton } from "@/components/ui/skeleton";

export default function NewCorrectionLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading the correction form"
      className="flex max-w-2xl flex-col gap-4"
    >
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-20 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="h-32" />
    </div>
  );
}
