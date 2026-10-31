import Link from "next/link";

import { cn } from "@/lib/utils";

/** Links that act as tabs for a list's status filter (kept in the URL). */
export function StatusTabs({
  label,
  tabs,
}: {
  label: string;
  tabs: { label: string; href: string; active: boolean }[];
}) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 sm:w-fit">
      {tabs.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-2 text-center text-sm font-medium whitespace-nowrap",
            tab.active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
