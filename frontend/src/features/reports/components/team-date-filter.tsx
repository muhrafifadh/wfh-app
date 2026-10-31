"use client";

import { useState, useTransition } from "react";

import { useQueryStates } from "nuqs";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { teamSearchParams } from "@/features/reports/search-params";

/** UX_FLOWS.md §10 — the team's work date: today by default, back 90 days. */
export function TeamDateFilter({ date, min, max }: { date: string; min: string; max: string }) {
  const [isPending, startTransition] = useTransition();
  const [, setFilters] = useQueryStates(teamSearchParams, { shallow: false, startTransition });
  const [value, setValue] = useState(date);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      noValidate
      aria-busy={isPending}
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!value || value < min || value > max) {
          setError("Choose a date in the last 90 days.");
          return;
        }
        setError(null);
        void setFilters({ date: value === max ? null : value });
      }}
    >
      <Field className="w-44">
        <FieldLabel htmlFor="team-date">Work date</FieldLabel>
        <Input
          id="team-date"
          type="date"
          min={min}
          max={max}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "team-date-error" : undefined}
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>
      <Button type="submit" variant="outline" disabled={isPending}>
        Show
      </Button>
      {error && (
        <FieldError id="team-date-error" className="basis-full">
          {error}
        </FieldError>
      )}
    </form>
  );
}
