"use client";

import { useState } from "react";

import { MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteInvoiceAction } from "@/features/invoices/actions";

type InvoiceRowActionsProps = { invoice: { id: string; number: string } };

/** The "…" menu on an invoice row. Delete asks for confirmation first. */
export function InvoiceRowActions({ invoice }: InvoiceRowActionsProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleDelete() {
    const result = await deleteInvoiceAction(invoice);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(`Invoice ${result.data.number} deleted`, {
      description: "This is an example, so nothing was deleted.",
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${invoice.number}`}>
            <MoreHorizontalIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(true)}>
            <Trash2Icon aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete invoice ${invoice.number}?`}
        description="The invoice will be removed. This can't be undone."
        confirmLabel="Delete invoice"
        pendingLabel="Deleting…"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
