"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { useQueryStates } from "nuqs";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { routes } from "@/config/routes";
import {
  HISTORY_STATUS_LABEL,
  HISTORY_STATUSES,
  type HistoryStatus,
} from "@/features/attendance/constants";
import { historyRange } from "@/features/attendance/dates";
import { historySearchParams } from "@/features/attendance/search-params";

const ALL = "all";

/**
 * UX_FLOWS.md §8 — the daily view's range and status, kept in the URL. The range is
 * checked here before any request (and again on the server, for edited URLs).
 */
export function HistoryFilters({ from, to, today }: { from: string; to: string; today: string }) {
  const [isPending, startTransition] = useTransition();
  const [{ status }, setFilters] = useQueryStates(historySearchParams, {
    shallow: false,
    startTransition,
  });
  const [range, setRange] = useState({ from, to });
  const [error, setError] = useState<string | null>(null);

  const apply = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const checked = historyRange(range, today);
    if ("error" in checked) return setError(checked.error);
    setError(null);
    void setFilters({ from: checked.from, to: checked.to, page: null });
  };

  return (
    <form
      onSubmit={apply}
      aria-label="Filter history"
      aria-busy={isPending}
      className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      noValidate
    >
      <Field className="sm:w-44">
        <FieldLabel htmlFor="history-from">From</FieldLabel>
        <Input
          id="history-from"
          type="date"
          value={range.from}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "history-range-error" : undefined}
          onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))}
        />
      </Field>
      <Field className="sm:w-44">
        <FieldLabel htmlFor="history-to">To</FieldLabel>
        <Input
          id="history-to"
          type="date"
          value={range.to}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "history-range-error" : undefined}
          onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))}
        />
      </Field>
      <Field className="sm:w-44">
        <FieldLabel htmlFor="history-status">Status</FieldLabel>
        <Select
          value={status ?? ALL}
          onValueChange={(value) =>
            void setFilters({
              status: value === ALL ? null : (value as HistoryStatus),
              page: null,
            })
          }
        >
          <SelectTrigger id="history-status" className="w-full">
            <SelectValue>{status ? HISTORY_STATUS_LABEL[status] : "All statuses"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {HISTORY_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {HISTORY_STATUS_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          Apply
        </Button>
        <Button variant="ghost" asChild>
          <Link href={routes.attendanceHistory()}>Reset filters</Link>
        </Button>
      </div>
      {error && (
        <FieldError id="history-range-error" className="basis-full">
          {error}
        </FieldError>
      )}
    </form>
  );
}
