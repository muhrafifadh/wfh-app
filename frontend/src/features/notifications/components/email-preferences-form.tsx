"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Control } from "react-hook-form";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { updateEmailPreferencesAction } from "@/features/notifications/actions";
import { emailPreferencesSchema, type EmailPreferences } from "@/features/notifications/schemas";
import { applyServerErrors } from "@/lib/form-errors";

const FIELDS = [
  "reviewRequestsEmail",
  "correctionUpdatesEmail",
  "checkInReminderEmail",
  "checkOutReminderEmail",
] as const;

type Shown = { reviewRequests: boolean; correctionUpdates: boolean; reminders: boolean };

/**
 * DOMAIN_RULES.md §18.7 — which notifications also come by email. Only the kinds that
 * apply to this user are shown; the others are sent back unchanged. Turning one off
 * keeps it in the app.
 */
export function EmailPreferencesForm({
  preferences,
  shown,
}: {
  preferences: EmailPreferences;
  shown: Shown;
}) {
  const form = useForm<EmailPreferences>({
    resolver: zodResolver(emailPreferencesSchema),
    defaultValues: preferences,
  });
  const { isSubmitting, isDirty, errors } = form.formState;

  if (!shown.reviewRequests && !shown.correctionUpdates && !shown.reminders) {
    return (
      <p className="text-sm text-muted-foreground">No email notifications apply to your account.</p>
    );
  }

  async function handleSubmit(values: EmailPreferences) {
    const result = await updateEmailPreferencesAction(values);
    if (!result.ok) {
      applyServerErrors(form, FIELDS, result.error, result.fieldErrors);
      return;
    }
    toast.success("Email preferences saved");
    form.reset(result.data);
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="grid gap-6">
      <FieldGroup className="gap-4">
        {errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}
        {shown.reviewRequests && (
          <PreferenceField
            control={form.control}
            name="reviewRequestsEmail"
            label="Correction requests to review"
            description="When someone you review asks to correct their attendance."
          />
        )}
        {shown.correctionUpdates && (
          <PreferenceField
            control={form.control}
            name="correctionUpdatesEmail"
            label="Decisions on my corrections"
            description="When your correction request is approved or rejected."
          />
        )}
        {shown.reminders && (
          <>
            <PreferenceField
              control={form.control}
              name="checkInReminderEmail"
              label="Check-in reminders"
              description="On working days when you haven't checked in by the reminder time."
            />
            <PreferenceField
              control={form.control}
              name="checkOutReminderEmail"
              label="Check-out reminders"
              description="On working days when you checked in and haven't checked out."
            />
          </>
        )}
      </FieldGroup>
      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </form>
  );
}

function PreferenceField({
  control,
  name,
  label,
  description,
}: {
  control: Control<EmailPreferences>;
  name: (typeof FIELDS)[number];
  label: string;
  description: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field orientation="horizontal" className="items-start">
          <Checkbox
            id={name}
            checked={field.value}
            onCheckedChange={(next) => field.onChange(next === true)}
            aria-describedby={`${name}-description`}
          />
          <div className="grid gap-1">
            <FieldLabel htmlFor={name}>{label}</FieldLabel>
            <FieldDescription id={`${name}-description`}>{description}</FieldDescription>
          </div>
        </Field>
      )}
    />
  );
}
