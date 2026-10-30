"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { TextField } from "@/components/shared/text-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { updateOrganizationSettingsAction } from "@/features/work-settings/actions";
import {
  organizationSettingsSchema,
  type OrganizationSettings,
  type OrganizationSettingsInput,
  type WorkSettings,
} from "@/features/work-settings/schemas";
import { applyServerErrors } from "@/lib/form-errors";

/** UX_FLOWS.md §15.1: support contact and data retention. */
export function OrganizationSettingsForm({ settings }: { settings: WorkSettings }) {
  const form = useForm<OrganizationSettingsInput, unknown, OrganizationSettings>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues: {
      supportContact: settings.supportContact ?? "",
      retentionYears: String(settings.retentionYears),
    },
  });
  const { isSubmitting, isDirty, errors } = form.formState;

  async function handleSubmit(values: OrganizationSettings) {
    const result = await updateOrganizationSettingsAction(values);
    if (!result.ok) {
      applyServerErrors(
        form,
        ["supportContact", "retentionYears"],
        result.error,
        result.fieldErrors,
      );
      return;
    }
    toast.success("Organization settings saved");
    form.reset({
      supportContact: result.data.supportContact ?? "",
      retentionYears: String(result.data.retentionYears),
    });
  }

  return (
    <form onSubmit={form.handleSubmit(handleSubmit)} noValidate className="grid gap-6">
      <FieldGroup>
        {errors.root && (
          <Alert variant="destructive">
            <AlertDescription>{errors.root.message}</AlertDescription>
          </Alert>
        )}
        <TextField
          control={form.control}
          name="supportContact"
          label="Support contact"
          autoComplete="off"
          description="Shown to everyone under Get help: an email, a link, or a name and extension."
        />
        <TextField
          control={form.control}
          name="retentionYears"
          label="Keep records for (years)"
          type="number"
          inputProps={{ min: 1, max: 10, step: 1, inputMode: "numeric" }}
          description="Attendance, corrections and audit entries. 1 to 10 years."
        />
      </FieldGroup>
      <div>
        <Button type="submit" disabled={isSubmitting || !isDirty}>
          {isSubmitting ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
