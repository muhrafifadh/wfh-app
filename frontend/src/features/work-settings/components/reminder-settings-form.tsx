"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch, type Control } from "react-hook-form";
import { toast } from "sonner";

import { TextField } from "@/components/shared/text-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { updateReminderSettingsAction } from "@/features/work-settings/actions";
import { formatLocalTime } from "@/features/work-settings/format";
import {
  reminderSettingsSchema,
  type ReminderSettings,
  type WorkSettings,
} from "@/features/work-settings/schemas";
import { applyServerErrors } from "@/lib/form-errors";
import { timeZoneLabel } from "@/lib/time-zone";

const FIELDS = [
  "checkInReminderEnabled",
  "checkInReminderTime",
  "checkOutReminderEnabled",
  "checkOutReminderTime",
] as const;

const valuesOf = (settings: WorkSettings): ReminderSettings => ({
  checkInReminderEnabled: settings.checkInReminderEnabled,
  checkInReminderTime: settings.checkInReminderTime,
  checkOutReminderEnabled: settings.checkOutReminderEnabled,
  checkOutReminderTime: settings.checkOutReminderTime,
});

/**
 * DOMAIN_RULES.md §18.4 — the check-in and check-out reminder emails. Each is on or off
 * with a time in the schedule's zone; changes apply from the next check (every 5 minutes).
 */
export function ReminderSettingsForm({ settings }: { settings: WorkSettings }) {
  const form = useForm<ReminderSettings>({
    resolver: zodResolver(reminderSettingsSchema),
    defaultValues: valuesOf(settings),
  });
  const { isSubmitting, isDirty, errors } = form.formState;
  const zone = timeZoneLabel(settings.timezone);
  const schedule = settings.currentSchedule;

  async function handleSubmit(values: ReminderSettings) {
    const result = await updateReminderSettingsAction(values);
    if (!result.ok) {
      applyServerErrors(form, FIELDS, result.error, result.fieldErrors);
      return;
    }
    toast.success("Reminder settings saved");
    form.reset(valuesOf(result.data));
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="grid gap-6">
      <FieldGroup>
        {errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}
        <ReminderFields
          control={form.control}
          kind="checkIn"
          legend="Check-in reminder"
          label="Email employees who haven't checked in"
          zone={zone}
          description={
            schedule
              ? `Sent on working days while check-in is open (${formatLocalTime(schedule.checkInOpensAt)}–${formatLocalTime(schedule.checkInClosesAt)} ${zone}). Not sent more than 2 hours late.`
              : "Sent on working days while check-in is open. Not sent more than 2 hours late."
          }
        />
        <ReminderFields
          control={form.control}
          kind="checkOut"
          legend="Check-out reminder"
          label="Email employees who checked in and haven't checked out"
          zone={zone}
          description={
            schedule
              ? `Sent on working days before check-out closes (${formatLocalTime(schedule.checkOutDeadline)} ${zone}). Not sent more than 2 hours late.`
              : "Sent on working days before check-out closes. Not sent more than 2 hours late."
          }
        />
      </FieldGroup>
      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save reminders"}
        </Button>
      </div>
    </form>
  );
}

function ReminderFields({
  control,
  kind,
  legend,
  label,
  zone,
  description,
}: {
  control: Control<ReminderSettings>;
  kind: "checkIn" | "checkOut";
  legend: string;
  label: string;
  zone: string;
  description: string;
}) {
  const enabledName = `${kind}ReminderEnabled` as const;
  const enabled = useWatch({ control, name: enabledName });

  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <Controller
        control={control}
        name={enabledName}
        render={({ field }) => (
          <Field orientation="horizontal">
            <Checkbox
              id={enabledName}
              checked={field.value}
              onCheckedChange={(next) => field.onChange(next === true)}
            />
            <FieldLabel htmlFor={enabledName} className="font-normal">
              {label}
            </FieldLabel>
          </Field>
        )}
      />
      <TextField
        control={control}
        name={`${kind}ReminderTime`}
        label={`Send at (${zone})`}
        type="time"
        disabled={!enabled}
        description={description}
      />
    </FieldSet>
  );
}
