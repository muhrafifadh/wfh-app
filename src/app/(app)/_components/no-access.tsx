import { EmptyState } from "@/components/shared/empty-state";

/** UX_FLOWS.md §17: the forbidden state, with the page's own heading. */
export function NoAccess({ title }: { title: string }) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <EmptyState
        title="You don't have access to this page"
        description="Ask your Admin/HR if you think you should."
      />
    </>
  );
}
