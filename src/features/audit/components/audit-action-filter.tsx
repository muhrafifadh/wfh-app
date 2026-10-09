"use client";

import { useTransition } from "react";

import { useQueryStates } from "nuqs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUDIT_ACTION_LABELS, AUDIT_ACTIONS } from "@/features/audit/constants";
import { auditSearchParams } from "@/features/audit/search-params";

const ALL = "all";

export function AuditActionFilter() {
  const [isPending, startTransition] = useTransition();
  const [{ action }, setFilters] = useQueryStates(auditSearchParams, {
    shallow: false,
    startTransition,
  });

  return (
    <div className="flex items-center gap-2">
      <Select
        value={action ?? ALL}
        onValueChange={(value) =>
          setFilters({ action: AUDIT_ACTIONS.find((a) => a === value) ?? null, page: null })
        }
      >
        <SelectTrigger aria-label="Filter by action" className="w-full sm:w-64">
          <SelectValue>{action ? AUDIT_ACTION_LABELS[action] : "All actions"}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All actions</SelectItem>
          {AUDIT_ACTIONS.map((a) => (
            <SelectItem key={a} value={a}>
              {AUDIT_ACTION_LABELS[a]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p role="status" className="text-sm text-muted-foreground">
        {isPending ? "Updating…" : ""}
      </p>
    </div>
  );
}
