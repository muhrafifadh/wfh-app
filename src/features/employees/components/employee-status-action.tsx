"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deactivateEmployeeAction, reactivateEmployeeAction } from "@/features/employees/actions";
import type { Employee } from "@/features/employees/schemas";

/** Deactivate (with an explanation) or reactivate. There's no delete. */
export function EmployeeStatusAction({
  employee,
}: {
  employee: Pick<Employee, "id" | "fullName" | "status" | "account">;
}) {
  const [confirm, setConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (employee.status === "inactive") {
    return (
      <Button
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            const result = await reactivateEmployeeAction(employee.id);
            if (result.ok) toast.success(`${employee.fullName} was reactivated`);
            else toast.error(result.error);
          })
        }
      >
        {isPending ? "Reactivating…" : "Reactivate"}
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setConfirm(true)}>
        Deactivate
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Deactivate ${employee.fullName}?`}
        description={
          <span className="grid gap-2">
            <span>
              From now on they can&apos;t check in, and close-day stops marking them absent. Their
              attendance history and corrections are kept, and you can reactivate them later.
            </span>
            {employee.account?.status === "active" && (
              <span>
                Their account can still sign in. To block sign-in too, deactivate the user on the
                Users page.
              </span>
            )}
          </span>
        }
        confirmLabel="Deactivate"
        pendingLabel="Deactivating…"
        destructive
        onConfirm={async () => {
          const result = await deactivateEmployeeAction(employee.id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success(`${employee.fullName} was deactivated`);
        }}
      />
    </>
  );
}
