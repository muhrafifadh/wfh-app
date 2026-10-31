"use client";

import { useState, useTransition } from "react";

import { useQueryStates } from "nuqs";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { reportRange } from "@/features/reports/range";
import { reportSearchParams } from "@/features/reports/search-params";

/** UX_FLOWS.md §11.1 — the required range, checked here before any request. */
export function ReportRangeFilter({
  from,
  to,
  today,
}: {
  from: string;
  to: string;
  today: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [, setFilters] = useQueryStates(reportSearchParams, { shallow: false, startTransition });
  const [range, setRange] = useState({ from, to });
  const [error, setError] = useState<string | null>(null);
  const describedBy = error ? "report-range-error" : undefined;

  return (
    <form
      noValidate
      aria-label="Report dates"
      aria-busy={isPending}
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const checked = reportRange(range, today);
        if ("error" in checked) return setError(checked.error);
        setError(null);
        void setFilters({ from: checked.from, to: checked.to, page: null });
      }}
    >
      <Field className="w-40">
        <FieldLabel htmlFor="report-from">From</FieldLabel>
        <Input
          id="report-from"
          type="date"
          value={range.from}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => setRange((r) => ({ ...r, from: event.target.value }))}
        />
      </Field>
      <Field className="w-40">
        <FieldLabel htmlFor="report-to">To</FieldLabel>
        <Input
          id="report-to"
          type="date"
          value={range.to}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => setRange((r) => ({ ...r, to: event.target.value }))}
        />
      </Field>
      <Button type="submit" variant="outline" disabled={isPending}>
        Apply
      </Button>
      {error && (
        <FieldError id="report-range-error" className="basis-full">
          {error}
        </FieldError>
      )}
    </form>
  );
}
