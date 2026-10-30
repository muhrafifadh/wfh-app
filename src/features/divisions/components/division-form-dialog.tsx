"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { TextField } from "@/components/shared/text-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { createDivisionAction, updateDivisionAction } from "@/features/divisions/actions";
import {
  divisionFormSchema,
  type Division,
  type DivisionFormInput,
} from "@/features/divisions/schemas";
import { applyServerErrors } from "@/lib/form-errors";

const FIELDS = ["code", "name"] as const;

type DivisionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edits this division; creates a new one when left out. */
  division?: Pick<Division, "id" | "code" | "name">;
};

/** Create or edit a division. Controlled, so a button or a row menu can open it. */
export function DivisionFormDialog({ open, onOpenChange, division }: DivisionFormDialogProps) {
  const form = useForm<DivisionFormInput>({
    resolver: zodResolver(divisionFormSchema),
    defaultValues: { code: division?.code ?? "", name: division?.name ?? "" },
  });
  const { isSubmitting, errors } = form.formState;

  async function handleSubmit(values: DivisionFormInput) {
    const result = division
      ? await updateDivisionAction(division.id, values)
      : await createDivisionAction(values);
    if (result.ok) {
      toast.success(division ? `${result.data.name} was updated` : `${result.data.name} was added`);
      form.reset(division ? values : { code: "", name: "" });
      onOpenChange(false);
      return;
    }
    applyServerErrors(form, FIELDS, result.error, result.fieldErrors);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.clearErrors();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{division ? `Edit ${division.name}` : "Add a division"}</DialogTitle>
            <DialogDescription>
              The code is a short label used in reports and exports.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {errors.root && (
              <Alert variant="destructive">
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            )}
            <TextField
              control={form.control}
              name="code"
              label="Code"
              autoComplete="off"
              description="Letters, digits and dashes. Saved in uppercase."
              inputProps={{
                onBlur: (event) => form.setValue("code", event.target.value.trim().toUpperCase()),
              }}
            />
            <TextField control={form.control} name="name" label="Name" autoComplete="off" />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : division ? "Save changes" : "Add division"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
