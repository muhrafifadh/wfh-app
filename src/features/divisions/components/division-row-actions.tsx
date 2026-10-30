"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { CircleCheckIcon, CircleOffIcon, MoreHorizontalIcon, PencilIcon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { routes } from "@/config/routes";
import { deactivateDivisionAction, reactivateDivisionAction } from "@/features/divisions/actions";
import { DivisionFormDialog } from "@/features/divisions/components/division-form-dialog";
import type { Division } from "@/features/divisions/schemas";

type DivisionRowActionsProps = {
  division: Pick<Division, "id" | "code" | "name" | "status" | "activeEmployeeCount">;
};

/** The "…" menu on a division row: edit, deactivate (with confirmation), reactivate. */
export function DivisionRowActions({ division }: DivisionRowActionsProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const occupied = division.activeEmployeeCount > 0;

  async function handleDeactivate() {
    const result = await deactivateDivisionAction(division.id);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(`${division.name} was deactivated`);
  }

  function handleReactivate() {
    startTransition(async () => {
      const result = await reactivateDivisionAction(division.id);
      if (result.ok) toast.success(`${division.name} was reactivated`);
      else toast.error(result.error);
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={isPending}
            aria-label={`Actions for ${division.name}`}
          >
            <MoreHorizontalIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <PencilIcon aria-hidden />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {division.status === "inactive" ? (
            <DropdownMenuItem onSelect={handleReactivate}>
              <CircleCheckIcon aria-hidden />
              Reactivate
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDeactivate(true)}>
              <CircleOffIcon aria-hidden />
              Deactivate
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DivisionFormDialog open={editing} onOpenChange={setEditing} division={division} />
      <ConfirmDialog
        open={confirmDeactivate}
        onOpenChange={setConfirmDeactivate}
        title={occupied ? `${division.name} still has employees` : `Deactivate ${division.name}?`}
        description={
          occupied
            ? `${division.activeEmployeeCount} active employee${division.activeEmployeeCount === 1 ? " is" : "s are"} in this division. Move them to another division first, then deactivate it.`
            : "No one can be assigned to it afterwards. Past attendance keeps its division, and you can reactivate it later."
        }
        confirmLabel={occupied ? "View its employees" : "Deactivate"}
        pendingLabel={occupied ? undefined : "Deactivating…"}
        destructive={!occupied}
        onConfirm={
          occupied
            ? async () => router.push(routes.employeesInDivision(division.id))
            : handleDeactivate
        }
      />
    </>
  );
}
