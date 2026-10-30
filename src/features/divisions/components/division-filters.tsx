"use client";

import { useTransition } from "react";

import { XIcon } from "lucide-react";
import { debounce, useQueryStates } from "nuqs";

import { ListSearch } from "@/components/shared/list-search";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEARCH_DEBOUNCE_MS } from "@/config/constants";
import { DIVISION_STATUS_LABEL, DIVISION_STATUSES } from "@/features/divisions/constants";
import { divisionSearchParams } from "@/features/divisions/search-params";

const ALL = "all";

export function DivisionFilters() {
  const [isPending, startTransition] = useTransition();
  const [{ q, status }, setFilters] = useQueryStates(divisionSearchParams, {
    shallow: false,
    startTransition,
  });

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <ListSearch
        label="Search divisions"
        placeholder="Search code or name…"
        value={q}
        onChange={(value) =>
          setFilters(
            { q: value || null, page: null },
            { limitUrlUpdates: value ? debounce(SEARCH_DEBOUNCE_MS) : undefined },
          )
        }
      />
      <Select
        value={status ?? ALL}
        onValueChange={(value) =>
          setFilters({ status: DIVISION_STATUSES.find((s) => s === value) ?? null, page: null })
        }
      >
        <SelectTrigger aria-label="Filter by status" className="w-full sm:w-40">
          <SelectValue>{status ? DIVISION_STATUS_LABEL[status] : "All statuses"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {DIVISION_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {DIVISION_STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(q || status) && (
        <Button variant="ghost" onClick={() => setFilters({ q: null, status: null, page: null })}>
          <XIcon aria-hidden />
          Clear
        </Button>
      )}
      <p role="status" className="text-sm text-muted-foreground sm:ml-auto">
        {isPending ? "Updating…" : ""}
      </p>
    </div>
  );
}
