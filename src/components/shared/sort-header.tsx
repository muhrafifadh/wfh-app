import Link from "next/link";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";

import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type SortHeaderProps = {
  label: string;
  /** This column is the current sort, and in which direction. */
  active: "asc" | "desc" | null;
  /** The list sorted by this column (the opposite direction when already active). */
  href: string;
  className?: string;
};

/** A column header that links to the list sorted by that column. Server-rendered. */
export function SortHeader({ label, active, href, className }: SortHeaderProps) {
  const Icon = !active ? ArrowUpDownIcon : active === "asc" ? ArrowUpIcon : ArrowDownIcon;
  const next = active === "asc" ? "descending" : "ascending";

  return (
    <TableHead
      scope="col"
      aria-sort={active ? (active === "asc" ? "ascending" : "descending") : undefined}
      className={className}
    >
      <Link
        href={href}
        scroll={false}
        className="-mx-2 inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {label}
        {/* Only the active column's arrow on small screens: the others don't fit */}
        <Icon
          aria-hidden
          className={cn("size-3.5", !active && "hidden text-muted-foreground sm:block")}
        />
        <span className="sr-only">, sort {next}</span>
      </Link>
    </TableHead>
  );
}
