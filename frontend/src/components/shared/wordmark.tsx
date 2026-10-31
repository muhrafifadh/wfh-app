import { cn } from "@/lib/utils";

/** The text logo until an official one exists (PRODUCT_REQUIREMENTS.md §7.3). */
export function Wordmark({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span className={cn("font-semibold tracking-tight", className)} {...props}>
      Hadir<span className="text-primary">.in</span>
    </span>
  );
}
