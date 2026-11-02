"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { addOfficeAction, removeOfficeAction } from "@/features/attendance-verification/actions";
import { readLocation } from "@/features/attendance-verification/components/geolocation";
import { SUGGESTED_OFFICE_RADIUS_METERS } from "@/features/attendance-verification/constants";
import type { Office } from "@/features/attendance-verification/schemas";

const toNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));

/**
 * Decision V13: offices count for every employee, with no approval step. `canLocate` is false
 * when the deployment's Permissions-Policy blocks the browser's location.
 */
export function Offices({ offices, canLocate }: { offices: Office[]; canLocate: boolean }) {
  const [isPending, startTransition] = useTransition();
  const remove = (office: Office) =>
    startTransition(async () => {
      const result = await removeOfficeAction(office.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`${office.label} removed`);
    });

  return (
    <div className="grid gap-4">
      {offices.length === 0 ? (
        <EmptyState
          title="No offices"
          description="Without one, check-ins from an office count as outside the approved area."
        />
      ) : (
        <ul className="grid gap-3">
          {offices.map((office) => (
            <li
              key={office.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm"
            >
              <div className="grid gap-1">
                <p className="font-medium">{office.label}</p>
                <p className="text-muted-foreground">
                  {office.latitude}, {office.longitude}, radius {office.radiusMeters} m
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending}
                aria-label={`Remove ${office.label}`}
                onClick={() => remove(office)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <OfficeForm canLocate={canLocate} />
    </div>
  );
}

function OfficeForm({ canLocate }: { canLocate: boolean }) {
  const [label, setLabel] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState(String(SUGGESTED_OFFICE_RADIUS_METERS));
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [isPending, startTransition] = useTransition();

  const fillFromMyLocation = () =>
    startTransition(async () => {
      setError(null);
      const reading = await readLocation();
      if (!reading) {
        setError(
          "Your browser didn't share a location. Allow location for this site, or enter it by hand.",
        );
        return;
      }
      setLatitude(String(reading.latitude));
      setLongitude(String(reading.longitude));
    });

  const submit = () =>
    startTransition(async () => {
      setError(null);
      setFieldErrors({});
      const result = await addOfficeAction({
        label,
        latitude: toNumber(latitude),
        longitude: toNumber(longitude),
        radiusMeters: toNumber(radius),
      });
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      toast.success(`${label.trim()} added`);
      setLabel("");
      setLatitude("");
      setLongitude("");
      setRadius(String(SUGGESTED_OFFICE_RADIUS_METERS));
    });

  const numberField = (
    id: "latitude" | "longitude" | "radiusMeters",
    title: string,
    value: string,
    onChange: (next: string) => void,
    description?: string,
  ) => {
    const invalid = fieldErrors[id]?.[0];
    const message = invalid ?? description;
    return (
      <Field data-invalid={invalid ? true : undefined}>
        <FieldLabel htmlFor={`office-${id}`}>{title}</FieldLabel>
        <Input
          id={`office-${id}`}
          inputMode="decimal"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={message ? `office-${id}-description` : undefined}
        />
        {message && <FieldDescription id={`office-${id}-description`}>{message}</FieldDescription>}
      </Field>
    );
  };

  return (
    <form
      noValidate
      className="grid gap-4 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <FieldGroup>
        <Field data-invalid={fieldErrors.label?.[0] ? true : undefined}>
          <FieldLabel htmlFor="office-label">Office name</FieldLabel>
          <Input
            id="office-label"
            value={label}
            maxLength={120}
            onChange={(event) => setLabel(event.target.value)}
            aria-invalid={fieldErrors.label?.[0] ? true : undefined}
            aria-describedby={fieldErrors.label?.[0] ? "office-label-description" : undefined}
          />
          {fieldErrors.label?.[0] && (
            <FieldDescription id="office-label-description">
              {fieldErrors.label[0]}
            </FieldDescription>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          {numberField("latitude", "Latitude", latitude, setLatitude)}
          {numberField("longitude", "Longitude", longitude, setLongitude)}
        </div>
        {numberField(
          "radiusMeters",
          "Radius in metres",
          radius,
          setRadius,
          "How far from the centre still counts as the office.",
        )}
      </FieldGroup>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Add office"}
        </Button>
        {canLocate && (
          <Button type="button" variant="outline" disabled={isPending} onClick={fillFromMyLocation}>
            Use my current location
          </Button>
        )}
      </div>
    </form>
  );
}
