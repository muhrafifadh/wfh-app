"use client";

import { useTransition } from "react";

import { SearchIcon, XIcon } from "lucide-react";
import { debounce, useQueryStates } from "nuqs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEARCH_DEBOUNCE_MS } from "@/config/constants";
import { USER_STATUS_LABEL } from "@/features/users/components/user-status-badge";
import { USER_STATUSES } from "@/features/users/constants";
import { userSearchParams } from "@/features/users/search-params";

const ALL = "all";

export function UserFilters() {
  const [isPending, startTransition] = useTransition();
  // shallow: false re-renders the page on the server with the new params.
  const [{ q, status }, setFilters] = useQueryStates(userSearchParams, {
    shallow: false,
    startTransition,
  });

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative sm:max-w-xs sm:flex-1">
        <SearchIcon
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search users"
          placeholder="Search name or email…"
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
      <Select
        value={status ?? ALL}
        onValueChange={(value) =>
          setFilters({ status: USER_STATUSES.find((s) => s === value) ?? null, page: null })
        }
      >
        <SelectTrigger aria-label="Filter by status" className="w-full sm:w-40">
          <SelectValue>{status ? USER_STATUS_LABEL[status] : "All statuses"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {USER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {USER_STATUS_LABEL[s]}
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
