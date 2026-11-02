"use client";

import { useTransition } from "react";

import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { decideWorkLocationAction } from "@/features/attendance-verification/actions";
import type { WorkLocationRequest } from "@/features/attendance-verification/schemas";

/** Decision V5: Admin/HR approve; a change takes effect only when approved. */
export function WorkLocationRequests({ requests }: { requests: WorkLocationRequest[] }) {
  const [isPending, startTransition] = useTransition();
  if (requests.length === 0) {
    return <EmptyState title="No requests" description="New and changed areas show up here." />;
  }
  const decide = (id: string, decision: "approve" | "reject") =>
    startTransition(async () => {
      const result = await decideWorkLocationAction(id, decision);
      if (!result.ok) return void toast.error(result.error);
      toast.success(decision === "approve" ? "Area approved" : "Request rejected");
    });

  return (
    <ul className="grid gap-3">
      {requests.map((request) => (
        <li key={request.id} className="grid gap-2 rounded-md border p-3 text-sm">
          <p className="font-medium">
            {request.employee.fullName}{" "}
            <span className="font-normal text-muted-foreground">
              ({request.employee.employeeNumber})
            </span>
          </p>
          <p>
            “{request.label}”, about {request.latitude.toFixed(3)}, {request.longitude.toFixed(3)},
            radius {request.radiusMeters / 1000} km
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled={isPending} onClick={() => decide(request.id, "approve")}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => decide(request.id, "reject")}
            >
              Reject
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
