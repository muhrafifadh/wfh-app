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
import { EMPLOYEE_STATUS_LABEL, EMPLOYEE_STATUSES } from "@/features/employees/constants";
import type { DivisionOption } from "@/features/employees/schemas";
import { employeeSearchParams } from "@/features/employees/search-params";

const ALL = "all";

type EmployeeFiltersProps = {
  divisions: DivisionOption[];
  managers: { id: string; fullName: string }[];
};

export function EmployeeFilters({ divisions, managers }: EmployeeFiltersProps) {
  const [isPending, startTransition] = useTransition();
  const [{ q, status, divisionId, managerId }, setFilters] = useQueryStates(employeeSearchParams, {
    shallow: false,
    startTransition,
  });
  const division = divisions.find((d) => d.id === divisionId);
  const manager = managers.find((m) => m.id === managerId);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <ListSearch
        label="Search employees"
        placeholder="Search name, email or number…"
        value={q}
        onChange={(value) =>
          setFilters(
            { q: value || null, page: null },
            { limitUrlUpdates: value ? debounce(SEARCH_DEBOUNCE_MS) : undefined },
          )
        }
      />
      <Select
        value={divisionId ?? ALL}
        onValueChange={(value) =>
          setFilters({ divisionId: value === ALL ? null : value, page: null })
        }
      >
        <SelectTrigger aria-label="Filter by division" className="w-full sm:w-44">
          <SelectValue>{division?.name ?? "All divisions"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All divisions</SelectItem>
          {divisions.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
              {d.status === "inactive" && " (inactive)"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={managerId ?? ALL}
        onValueChange={(value) =>
          setFilters({ managerId: value === ALL ? null : value, page: null })
        }
      >
        <SelectTrigger aria-label="Filter by manager" className="w-full sm:w-44">
          <SelectValue>{manager?.fullName ?? "Any manager"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any manager</SelectItem>
          {managers.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={status ?? ALL}
        onValueChange={(value) =>
          setFilters({ status: EMPLOYEE_STATUSES.find((s) => s === value) ?? null, page: null })
        }
      >
        <SelectTrigger aria-label="Filter by status" className="w-full sm:w-36">
          <SelectValue>{status ? EMPLOYEE_STATUS_LABEL[status] : "All statuses"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {EMPLOYEE_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {EMPLOYEE_STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(q || status || divisionId || managerId) && (
        <Button
          variant="ghost"
          onClick={() =>
            setFilters({ q: null, status: null, divisionId: null, managerId: null, page: null })
          }
        >
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
