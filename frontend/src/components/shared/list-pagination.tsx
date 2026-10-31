import Link from "next/link";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type ListPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  /** The list URL for a page, keeping the current filters. */
  hrefFor: (page: number) => string;
};

/** "21–40 of 64" with previous/next links. Server-rendered; pages live in the URL. */
export function ListPagination({ page, pageSize, total, hrefFor }: ListPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted-foreground">
        {first}–{last} of {total}
      </p>
      <div className="flex items-center gap-2">
        <PageLink href={page > 1 ? hrefFor(page - 1) : null} label="Previous page">
          <ChevronLeftIcon aria-hidden />
        </PageLink>
        <span className="text-sm">
          Page {page} of {pageCount}
        </span>
        <PageLink href={page < pageCount ? hrefFor(page + 1) : null} label="Next page">
          <ChevronRightIcon aria-hidden />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <Button variant="outline" size="icon" disabled aria-label={label}>
        {children}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="icon" asChild>
      <Link href={href} scroll={false} aria-label={label}>
        {children}
      </Link>
    </Button>
  );
}
