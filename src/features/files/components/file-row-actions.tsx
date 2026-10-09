"use client";

import { useState } from "react";

import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { deleteFileAction } from "@/features/files/actions";

/** Delete, with confirmation. Shown only on your own files (the backend checks too). */
export function FileDeleteButton({ file }: { file: { id: string; filename: string } }) {
  const [confirm, setConfirm] = useState(false);

  async function handleDelete() {
    const result = await deleteFileAction(file.id);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(`${file.filename} deleted`);
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${file.filename}`}
        onClick={() => setConfirm(true)}
      >
        <Trash2Icon aria-hidden />
      </Button>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Delete ${file.filename}?`}
        description="It disappears from the list right away. The file itself is kept for 7 days, then removed for good."
        confirmLabel="Delete file"
        pendingLabel="Deleting…"
        destructive
        onConfirm={handleDelete}
      />
    </>
  );
}
