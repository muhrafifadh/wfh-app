"use client";

import { useTransition } from "react";

import { parseAsString, useQueryStates } from "nuqs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

type UrlSelectProps = {
  /** The URL parameter it sets, e.g. "divisionId". */
  param: string;
  /** Accessible name, e.g. "Filter by division". */
  label: string;
  /** Shown when nothing is chosen, e.g. "All divisions". */
  allLabel: string;
  options: { value: string; label: string }[];
  className?: string;
};

/**
 * docs/11-state-and-url-params.md — a filter select kept in the URL. Choosing a value
 * resets the list to its first page and re-renders the page on the server.
 */
export function UrlSelect({ param, label, allLabel, options, className }: UrlSelectProps) {
  const [, startTransition] = useTransition();
  const [values, setValues] = useQueryStates(
    { [param]: parseAsString, page: parseAsString },
    { shallow: false, startTransition },
  );
  const value = values[param] ?? null;
  const selected = options.find((option) => option.value === value);

  return (
    <Select
      value={selected ? selected.value : ALL}
      onValueChange={(next) => void setValues({ [param]: next === ALL ? null : next, page: null })}
    >
      <SelectTrigger aria-label={label} className={className ?? "w-full sm:w-48"}>
        <SelectValue>{selected?.label ?? allLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
