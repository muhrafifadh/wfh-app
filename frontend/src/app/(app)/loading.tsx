import { Skeleton } from "@/components/ui/skeleton";

/**
 * Sits below the (app) layout, so client navigations between pages show this
 * while a page's request-time data (e.g. requireUser()) streams in.
 */
export default function AppLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-3">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-48" />
    </div>
  );
}
