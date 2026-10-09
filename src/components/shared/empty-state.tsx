import { cn } from "@/lib/utils";

type EmptyStateProps = React.ComponentProps<"div"> & {
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function EmptyState({ title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center",
        className,
      )}
      {...props}
    >
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
