"use client";

import { useState } from "react";

import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
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
import { deleteHolidayAction } from "@/features/holidays/actions";
import { HolidayFormDialog } from "@/features/holidays/components/holiday-form-dialog";
import type { Holiday } from "@/features/holidays/schemas";
import { formatDayDate } from "@/lib/format";

export function HolidayRowActions({
  holiday,
  today,
}: {
  holiday: Pick<Holiday, "id" | "date" | "name">;
  today: string;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const past = holiday.date < today;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${holiday.name}`}>
            <MoreHorizontalIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <PencilIcon aria-hidden />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2Icon aria-hidden />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <HolidayFormDialog open={editing} onOpenChange={setEditing} today={today} holiday={holiday} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Remove ${holiday.name}?`}
        description={
          past
            ? `${formatDayDate(holiday.date)} has passed. It becomes a working day again, but attendance already recorded for it is not recreated or changed. The removal is kept in the audit log.`
            : `${formatDayDate(holiday.date)} becomes a working day again: employees can check in, and close-day marks missing check-ins absent. The removal is kept in the audit log.`
        }
        confirmLabel="Remove holiday"
        pendingLabel="Removing…"
        destructive
        onConfirm={async () => {
          const result = await deleteHolidayAction(holiday.id);
          if (!result.ok) {
            toast.error(result.error);
            return false;
          }
          toast.success(`${holiday.name} was removed`);
        }}
      />
    </>
  );
}
