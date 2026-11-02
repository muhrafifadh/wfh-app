"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { updateVerificationSettingsAction } from "@/features/attendance-verification/actions";
import {
  needsJustification,
  type VerificationSettings,
} from "@/features/attendance-verification/schemas";

/**
 * Decision V7: each method separately, off by default, and a recorded reason to turn one
 * on. The reason goes in the audit log, so it must not name anyone.
 */
export function VerificationSettingsForm({ settings }: { settings: VerificationSettings }) {
  const [current, setCurrent] = useState(settings);
  const [locationEnabled, setLocationEnabled] = useState(settings.locationEnabled);
  const [selfieEnabled, setSelfieEnabled] = useState(settings.selfieEnabled);
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const turningOn = needsJustification(current, { locationEnabled, selfieEnabled });
  const dirty =
    locationEnabled !== current.locationEnabled || selfieEnabled !== current.selfieEnabled;

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await updateVerificationSettingsAction(current, {
        locationEnabled,
        selfieEnabled,
        justification,
      });
      if (!result.ok) {
        setError({ message: result.error, field: result.fieldErrors?.justification?.[0] });
        return;
      }
      setCurrent(result.data);
      setJustification("");
      toast.success("Attendance check settings saved");
    });

  return (
    <form
      noValidate
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      {!current.available && (
        <Alert>
          <AlertDescription>
            These checks are switched off for this deployment, so they can&apos;t be turned on here.
            They stay off until the deferred legal, privacy and hosting requirements are met.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="locationEnabled"
            checked={locationEnabled}
            disabled={!current.available && !current.locationEnabled}
            onCheckedChange={(next) => setLocationEnabled(next === true)}
          />
          <FieldLabel htmlFor="locationEnabled" className="font-normal">
            Location at check-in, compared with each employee&apos;s approved area
          </FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            id="selfieEnabled"
            checked={selfieEnabled}
            disabled={!current.available && !current.selfieEnabled}
            onCheckedChange={(next) => setSelfieEnabled(next === true)}
          />
          <FieldLabel htmlFor="selfieEnabled" className="font-normal">
            Check-in photo, kept 30 days (use only if location and existing controls aren&apos;t
            enough)
          </FieldLabel>
        </Field>
        {turningOn && (
          <Field data-invalid={error?.field ? true : undefined}>
            <FieldLabel htmlFor="justification">Why is this check needed?</FieldLabel>
            <Textarea
              id="justification"
              rows={3}
              maxLength={1000}
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              aria-invalid={error?.field ? true : undefined}
              aria-describedby="justification-description"
            />
            <FieldDescription id="justification-description">
              {error?.field ??
                "Describe the documented problem, e.g. incidents in the incident log. Don't name anyone: this goes in the audit log."}
            </FieldDescription>
          </Field>
        )}
      </FieldGroup>
      <div>
        <Button type="submit" disabled={isPending || !dirty}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}
