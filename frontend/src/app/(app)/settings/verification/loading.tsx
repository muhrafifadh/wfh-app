import { Skeleton } from "@/components/ui/skeleton";

export default function VerificationSettingsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading check-in checks" className="flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
