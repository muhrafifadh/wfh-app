"use client";

import { useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlertIcon } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SelectField } from "@/components/shared/select-field";
import { TextField } from "@/components/shared/text-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createScheduleAction, previewScheduleAction } from "@/features/work-settings/actions";
import { TIME_ZONES, WEEKDAYS } from "@/features/work-settings/constants";
import { scheduleValues } from "@/features/work-settings/format";
import {
  scheduleFormSchema,
  type ScheduleForm,
  type ScheduleFormInput,
  type SchedulePreview,
  type WorkSchedule,
  type WorkSettings,
} from "@/features/work-settings/schemas";
import { applyServerErrors } from "@/lib/form-errors";
import { formatDayDate } from "@/lib/format";
import { formatTimeIn, timeZoneLabel } from "@/lib/time-zone";
import { cn } from "@/lib/utils";

const FIELDS = [
  "name",
  "timezone",
  "workingDays",
  "startTime",
  "endTime",
  "toleranceMinutes",
  "checkInOpensAt",
  "checkInClosesAt",
  "checkOutDeadline",
  "effectiveFrom",
] as const;

const minutes = (time: string) => time.slice(0, 5);

/** The form starts from the schedule in force (or the baseline before there is one). */
function defaultsFrom(settings: WorkSettings): ScheduleFormInput {
  const current = settings.currentSchedule;
  return {
    name: current?.name ?? "Standard schedule",
    timezone: current?.timezone ?? settings.timezone,
    workingDays: current?.workingDays ?? [1, 2, 3, 4, 5],
    startTime: minutes(current?.startTime ?? "09:00"),
    endTime: minutes(current?.endTime ?? "17:00"),
    toleranceMinutes: String(current?.toleranceMinutes ?? 15),
    checkInOpensAt: minutes(current?.checkInOpensAt ?? "08:00"),
    checkInClosesAt: minutes(current?.checkInClosesAt ?? "17:00"),
    checkOutDeadline: minutes(current?.checkOutDeadline ?? "23:59"),
    effectiveFrom: settings.earliestEffectiveFrom,
  };
}

/**
 * UX_FLOWS.md §15.2 — a change is a new version from a future date: preview its
 * boundaries, review old against new, then save. History is never rewritten.
 */
export function ScheduleForm({
  settings,
  upcoming,
}: {
  settings: WorkSettings;
  /** A version planned after the current one, if any: new dates must come after it. */
  upcoming: WorkSchedule | null;
}) {
  const [preview, setPreview] = useState<{ key: string; result: SchedulePreview } | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [review, setReview] = useState<ScheduleForm | null>(null);
  const form = useForm<ScheduleFormInput, unknown, ScheduleForm>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: defaultsFrom(settings),
  });
  const { errors } = form.formState;
  const values = useWatch({ control: form.control });
  const valuesKey = JSON.stringify(values);
  const earliest = settings.earliestEffectiveFrom;
  const effectiveFrom = values.effectiveFrom ?? "";
  const conflictsWithUpcoming =
    upcoming !== null && effectiveFrom !== "" && effectiveFrom <= upcoming.effectiveFrom;
  const zones = [...new Set([...TIME_ZONES, settings.timezone])];

  /** Checks the date against the organization's earliest date, then runs `next`. */
  const withValidDate = (next: (values: ScheduleForm) => void | Promise<void>) =>
    form.handleSubmit(async (parsed) => {
      if (parsed.effectiveFrom < earliest) {
        form.setError("effectiveFrom", { message: `Use ${formatDayDate(earliest)} or later` });
        return;
      }
      await next(parsed);
    });

  const runPreview = withValidDate((parsed) =>
    startPreview(async () => {
      const result = await previewScheduleAction(parsed);
      if (result.ok) setPreview({ key: valuesKey, result: result.data });
      else applyServerErrors(form, FIELDS, result.error, result.fieldErrors);
    }),
  );

  async function save(): Promise<boolean> {
    if (!review) return true;
    const result = await createScheduleAction(review);
    if (!result.ok) {
      applyServerErrors(form, FIELDS, result.error, result.fieldErrors);
      return true;
    }
    toast.success(
      `${result.data.name} takes effect on ${formatDayDate(result.data.effectiveFrom)}`,
    );
    setPreview(null);
    return true;
  }

  const current = settings.currentSchedule;
  const changes = review
    ? scheduleValues(review).map(([label, next], i) => ({
        label,
        before: current ? (scheduleValues(current)[i]?.[1] ?? "—") : "—",
        after: next,
      }))
    : [];

  return (
    <>
      <form onSubmit={withValidDate(setReview)} noValidate className="grid gap-6">
        {errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}
        <FieldGroup>
          <TextField control={form.control} name="name" label="Name" autoComplete="off" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="effectiveFrom"
              label="Takes effect on"
              type="date"
              inputProps={{ min: earliest }}
              description={`${formatDayDate(earliest)} at the earliest. Past days keep the schedule they had.`}
            />
            <SelectField
              control={form.control}
              name="timezone"
              label="Time zone"
              options={zones.map((zone) => ({
                value: zone,
                label: `${zone} (${timeZoneLabel(zone)})`,
              }))}
            />
          </div>
          {conflictsWithUpcoming && upcoming && (
            <Alert>
              <TriangleAlertIcon aria-hidden />
              <AlertDescription>
                &ldquo;{upcoming.name}&rdquo; is already planned from{" "}
                {formatDayDate(upcoming.effectiveFrom)}. Choose a later date; a planned version
                can&apos;t be replaced.
              </AlertDescription>
            </Alert>
          )}
          <Controller
            control={form.control}
            name="workingDays"
            render={({ field, fieldState }) => (
              <FieldSet data-invalid={fieldState.invalid}>
                <FieldLegend variant="label">Working days</FieldLegend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {WEEKDAYS.map((day) => {
                    const checked = field.value.includes(day.value);
                    return (
                      <Field key={day.value} orientation="horizontal" className="w-auto">
                        <Checkbox
                          id={`workingDays-${day.value}`}
                          checked={checked}
                          onCheckedChange={(next) =>
                            field.onChange(
                              next
                                ? [...field.value, day.value]
                                : field.value.filter((value) => value !== day.value),
                            )
                          }
                        />
                        <FieldLabel htmlFor={`workingDays-${day.value}`} className="font-normal">
                          <span aria-hidden>{day.short}</span>
                          <span className="sr-only">{day.long}</span>
                        </FieldLabel>
                      </Field>
                    );
                  })}
                </div>
                <FieldDescription>Holidays are set on the Holidays page.</FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldSet>
            )}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField control={form.control} name="startTime" label="Start time" type="time" />
            <TextField control={form.control} name="endTime" label="End time" type="time" />
            <TextField
              control={form.control}
              name="toleranceMinutes"
              label="Late tolerance (min)"
              type="number"
              inputProps={{ min: 0, max: 120, step: 1, inputMode: "numeric" }}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              control={form.control}
              name="checkInOpensAt"
              label="Check-in opens"
              type="time"
            />
            <TextField
              control={form.control}
              name="checkInClosesAt"
              label="Check-in closes"
              type="time"
            />
            <TextField
              control={form.control}
              name="checkOutDeadline"
              label="Check-out closes"
              type="time"
              description="Open until the end of this minute."
            />
          </div>
        </FieldGroup>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={runPreview} disabled={isPreviewing}>
            {isPreviewing ? "Previewing…" : "Preview boundaries"}
          </Button>
          <Button type="submit" disabled={conflictsWithUpcoming}>
            Review and schedule
          </Button>
        </div>
      </form>
      {preview && (
        <SchedulePreviewTable
          preview={preview.result}
          timezone={form.getValues("timezone")}
          stale={preview.key !== valuesKey}
        />
      )}
      <ConfirmDialog
        open={review !== null}
        onOpenChange={(open) => !open && setReview(null)}
        title={`Schedule "${review?.name}" from ${review ? formatDayDate(review.effectiveFrom) : ""}?`}
        description={
          <span className="grid gap-3">
            <span>
              It applies from that day on. Days before it keep the schedule they had, and recorded
              attendance is not recalculated.
            </span>
            <span className="grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">Setting</span>
              <span className="font-medium">Now</span>
              <span className="font-medium">From then</span>
              {changes.map((change) => (
                <span key={change.label} className="contents">
                  <span>{change.label}</span>
                  <span>{change.before}</span>
                  <span className={cn(change.before !== change.after && "font-semibold")}>
                    {change.after}
                  </span>
                </span>
              ))}
            </span>
          </span>
        }
        confirmLabel="Schedule change"
        pendingLabel="Scheduling…"
        onConfirm={save}
      />
    </>
  );
}

function SchedulePreviewTable({
  preview,
  timezone,
  stale,
}: {
  preview: SchedulePreview;
  timezone: string;
  stale: boolean;
}) {
  const time = (iso: string) => formatTimeIn(iso, timezone);
  return (
    <section aria-labelledby="schedule-preview" className="grid gap-2">
      <h3 id="schedule-preview" className="font-medium">
        First 7 days ({timeZoneLabel(timezone)})
      </h3>
      <p className="text-sm text-muted-foreground">
        From the schedule alone: holidays are non-working days whatever it says.
      </p>
      {stale && (
        <p role="status" className="text-sm text-muted-foreground">
          You changed the form since this preview. Preview again to see the new boundaries.
        </p>
      )}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Date</TableHead>
              <TableHead scope="col">Check-in opens</TableHead>
              <TableHead scope="col">On time until</TableHead>
              <TableHead scope="col">Check-in closes</TableHead>
              <TableHead scope="col">Check-out closes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.days.map((day) => (
              <TableRow key={day.workDate}>
                <TableCell className="whitespace-nowrap">{formatDayDate(day.workDate)}</TableCell>
                {day.isScheduledWeekday ? (
                  <>
                    <TableCell>{time(day.checkInOpensAt)}</TableCell>
                    <TableCell>{time(day.onTimeDeadlineAt)}</TableCell>
                    <TableCell>{time(day.checkInClosesAt)}</TableCell>
                    <TableCell>{time(day.checkOutClosesAt)}</TableCell>
                  </>
                ) : (
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Not a working day
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
