import { Skeleton } from "@/components/ui/skeleton";

export default function NewEmployeeLoading() {
  return (
    <div aria-busy="true" aria-label="Loading form" className="flex max-w-2xl flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 7 }, (_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
