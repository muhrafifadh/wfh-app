import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeeLoading() {
  return (
    <div aria-busy="true" aria-label="Loading employee" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-[32rem]" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}
