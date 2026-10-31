"use client";

import { useTransition } from "react";

import { SearchIcon } from "lucide-react";
import { debounce, useQueryStates } from "nuqs";

import { Input } from "@/components/ui/input";
import { SEARCH_DEBOUNCE_MS } from "@/config/constants";
import { fileSearchParams } from "@/features/files/search-params";

export function FileSearch() {
  const [isPending, startTransition] = useTransition();
  const [{ q }, setFilters] = useQueryStates(fileSearchParams, { shallow: false, startTransition });

  return (
    <div className="flex items-center gap-2">
      <div className="relative w-full sm:max-w-xs">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search files"
          placeholder="Search file names…"
          value={q}
          onChange={(e) =>
            setFilters(
              { q: e.target.value || null, page: null },
              { limitUrlUpdates: e.target.value ? debounce(SEARCH_DEBOUNCE_MS) : undefined },
            )
          }
          className="pl-8"
        />
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {isPending ? "Updating…" : ""}
      </p>
    </div>
  );
}
