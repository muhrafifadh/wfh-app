"use client";

import { useTransition } from "react";

import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatLongDate } from "@/features/attendance/format";
import { requestPhotoAction } from "@/features/attendance-verification/actions";
import { ResultBadge } from "@/features/attendance-verification/components/result-badge";
import { METHOD_LABELS } from "@/features/attendance-verification/constants";
import type { MyResult } from "@/features/attendance-verification/schemas";

const REQUEST_LABELS = {
  open: "Requested",
  disclosed: "Shared with you",
  declined: "Declined",
} as const;

/** The employee's own results within retention, and a way to ask for their photo (V12). */
export function MyResults({ results }: { results: MyResult[] }) {
  const [isPending, startTransition] = useTransition();
  if (results.length === 0) {
    return (
      <EmptyState
        title="Nothing recorded"
        description="Results from your check-ins show here for 90 days."
      />
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Check</TableHead>
          <TableHead>Result</TableHead>
          <TableHead>Photo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{formatLongDate(row.workDate)}</TableCell>
            <TableCell>{METHOD_LABELS[row.method]}</TableCell>
            <TableCell>
              <ResultBadge result={row.result} />
            </TableCell>
            <TableCell>
              {row.method !== "selfie" ? null : row.photoRequest === "open" ||
                row.photoRequest === "disclosed" ? (
                REQUEST_LABELS[row.photoRequest]
              ) : row.photoAvailable ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await requestPhotoAction(row.id);
                      if (!result.ok) return void toast.error(result.error);
                      toast.success("Request sent to Admin/HR.");
                    })
                  }
                >
                  Request a copy
                </Button>
              ) : (
                <span className="text-muted-foreground">Deleted</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
