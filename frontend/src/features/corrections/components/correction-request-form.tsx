"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { InfoIcon, LoaderCircleIcon } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { TextField } from "@/components/shared/text-field";
import { TextareaField } from "@/components/shared/textarea-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { routes } from "@/config/routes";
import { previewCorrectionAction, submitCorrectionAction } from "@/features/corrections/actions";
import { CorrectionComparison } from "@/features/corrections/components/correction-comparison";
import {
  correctionFormSchema,
  type CorrectionForm,
  type CorrectionFormInput,
  type CorrectionPreview,
} from "@/features/corrections/schemas";
import { applyServerErrors } from "@/lib/form-errors";
import { formatTimeIn, timeZoneLabel } from "@/lib/time-zone";

const FIELDS = ["checkIn", "checkOut", "reason"] as const;

type CorrectionRequestFormProps = {
  attendanceId: string;
  workDate: string;
  timezone: string;
  current: { checkInAt: string | null; checkOutAt: string | null };
  /** "Friday, 6 November 2026": the last day a request is accepted. */
  deadline: string;
};

/**
 * UX_FLOWS.md §9.1 — propose a check-in and/or check-out on the work date, see what the
 * server would make of it, and explain why. Nothing changes until someone approves.
 */
export function CorrectionRequestForm({
  attendanceId,
  workDate,
  timezone,
  current,
  deadline,
}: CorrectionRequestFormProps) {
  const router = useRouter();
  const form = useForm<CorrectionFormInput, unknown, CorrectionForm>({
    resolver: zodResolver(correctionFormSchema),
    defaultValues: { attendanceId, workDate, timezone, checkIn: "", checkOut: "", reason: "" },
  });
  const { isSubmitting, errors } = form.formState;
  const [preview, setPreview] = useState<{ times: string; result: CorrectionPreview } | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const zone = timeZoneLabel(timezone);
  // What leaving a time blank means, in words ("none" read as a time confused the pilot)
  const keepHint = (value: string | null, what: string) =>
    value
      ? `Leave blank to keep ${formatTimeIn(value, timezone).slice(0, 5)} ${zone}.`
      : `No ${what} is recorded. Leave blank to keep it that way.`;

  const [checkIn, checkOut] = useWatch({ control: form.control, name: ["checkIn", "checkOut"] });
  const times = `${checkIn}|${checkOut}`;

  /** Asks the server what these times would do; runs when a time field loses focus. */
  const runPreview = () => {
    const values = form.getValues();
    if (!values.checkIn && !values.checkOut) return setPreview(null);
    const times = `${values.checkIn}|${values.checkOut}`;
    if (preview?.times === times) return;
    startPreview(async () => {
      form.clearErrors(["checkIn", "checkOut"]);
      form.clearErrors("root");
      const result = await previewCorrectionAction(values);
      if (result.ok) return setPreview({ times, result: result.data });
      setPreview(null);
      applyServerErrors(form, ["checkIn", "checkOut"], result.error, result.fieldErrors);
    });
  };

  async function handleSubmit(values: CorrectionForm) {
    const result = await submitCorrectionAction(values);
    if (result.ok) {
      toast.success("Correction requested. Your attendance changes only if it's approved.");
      router.push(routes.correction(result.data.id));
      return;
    }
    applyServerErrors(form, FIELDS, result.error, result.fieldErrors);
  }

  const stale = preview !== null && preview.times !== times;

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
      className="flex max-w-2xl flex-col gap-6"
    >
      <FieldGroup>
        {errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="checkIn"
            label={`Proposed check-in (${zone})`}
            type="time"
            description={keepHint(current.checkInAt, "check-in")}
            inputProps={{ onBlur: runPreview }}
          />
          <TextField
            control={form.control}
            name="checkOut"
            label={`Proposed check-out (${zone})`}
            type="time"
            description={keepHint(current.checkOutAt, "check-out")}
            inputProps={{ onBlur: runPreview }}
          />
        </div>

        <section
          aria-labelledby="preview-heading"
          className="flex flex-col gap-2"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <h2 id="preview-heading" className="text-base font-semibold">
              Preview
            </h2>
            {isPreviewing && (
              <LoaderCircleIcon aria-label="Calculating" className="size-4 animate-spin" />
            )}
          </div>
          {preview && !stale ? (
            <>
              <CorrectionComparison {...preview.result} />
              <p className="text-xs text-muted-foreground">
                Calculated by the server with this day&apos;s schedule. The final result is worked
                out again when the request is approved.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {stale
                ? "The times changed. Leave the time field to update the preview."
                : "Enter a time to see the resulting status and duration."}
            </p>
          )}
        </section>

        <TextareaField
          control={form.control}
          name="reason"
          label="Reason"
          description="What happened, in 10 to 1,000 characters. Your reviewer sees this."
          maxLength={1000}
        />
      </FieldGroup>

      <Alert>
        <InfoIcon aria-hidden />
        <AlertDescription>
          You can request a correction until {deadline}. Your attendance doesn&apos;t change until
          the request is approved.
        </AlertDescription>
      </Alert>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting} className="h-11">
          {isSubmitting ? "Sending…" : "Request correction"}
        </Button>
        <Button type="button" variant="ghost" className="h-11" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
