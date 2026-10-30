"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlertIcon } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
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
import { createHolidayAction, updateHolidayAction } from "@/features/holidays/actions";
import {
  holidayFormSchema,
  type Holiday,
  type HolidayFormInput,
} from "@/features/holidays/schemas";
import { applyServerErrors } from "@/lib/form-errors";
import { formatDayDate } from "@/lib/format";

type HolidayFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The organization's date: earlier dates get a warning (DOMAIN_RULES.md §6.3). */
  today: string;
  /** Edits this holiday; adds a new one when left out. */
  holiday?: Pick<Holiday, "id" | "date" | "name">;
  /** Prefills a new holiday's date (e.g. in the year being viewed). */
  defaultDate?: string;
};

export function HolidayFormDialog({
  open,
  onOpenChange,
  today,
  holiday,
  defaultDate = "",
}: HolidayFormDialogProps) {
  const form = useForm<HolidayFormInput>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: { date: holiday?.date ?? defaultDate, name: holiday?.name ?? "" },
  });
  const { isSubmitting, errors } = form.formState;
  const date = useWatch({ control: form.control, name: "date" });
  const past = Boolean(date) && date < today;

  async function handleSubmit(values: HolidayFormInput) {
    const result = holiday
      ? await updateHolidayAction(holiday.id, values)
      : await createHolidayAction(values);
    if (result.ok) {
      toast.success(
        `${result.data.name} on ${formatDayDate(result.data.date)} was ${holiday ? "updated" : "added"}`,
      );
      form.reset(holiday ? values : { date: defaultDate, name: "" });
      onOpenChange(false);
      return;
    }
    applyServerErrors(form, ["date", "name"], result.error, result.fieldErrors);
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
            <DialogTitle>{holiday ? `Edit ${holiday.name}` : "Add a holiday"}</DialogTitle>
            <DialogDescription>
              Nobody can check in on a holiday, and nobody is marked absent.
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            {errors.root && (
              <Alert variant="destructive">
                <AlertDescription>{errors.root.message}</AlertDescription>
              </Alert>
            )}
            <TextField control={form.control} name="date" label="Date" type="date" />
            {past && (
              <Alert>
                <TriangleAlertIcon aria-hidden />
                <AlertDescription>
                  This date has passed. Attendance already recorded that day stays as it is,
                  including absences from close-day; correct individual records if needed.
                </AlertDescription>
              </Alert>
            )}
            <TextField control={form.control} name="name" label="Name" autoComplete="off" />
          </FieldGroup>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : holiday ? "Save changes" : "Add holiday"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
