"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { CheckIcon, XIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { STATUS_BADGES } from "@/components/shared/status-badge";
import { TextareaField } from "@/components/shared/textarea-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { approveCorrectionAction, rejectCorrectionAction } from "@/features/corrections/actions";
import { approveSchema, rejectSchema, type Correction } from "@/features/corrections/schemas";
import { formatDuration } from "@/lib/format";

type DecisionForm = { decisionNote: string };

/**
 * UX_FLOWS.md §9.4 — Approve (note optional, confirmed first) and Reject (note required)
 * are separate actions. Only rendered when the server says the caller may decide.
 */
export function DecisionPanel({ correction }: { correction: Correction }) {
  const router = useRouter();
  const form = useForm<DecisionForm>({ defaultValues: { decisionNote: "" } });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isRejecting, startReject] = useTransition();
  const rootError = form.formState.errors.root?.message;
  const after = correction.outcome.requested;
  const resultText = `${STATUS_BADGES[after.status].label}${
    after.workedMinutes === null ? "" : `, ${formatDuration(after.workedMinutes)}`
  }`;

  // The panel can disappear on refresh (e.g. someone else decided first), so the
  // reason is also announced as a toast
  const failed = (message: string) => {
    form.setError("root", { message });
    toast.error(message);
  };

  const done = (verb: "approved" | "rejected") => {
    toast.success(`Correction ${verb} for ${correction.employee.fullName}.`);
    router.refresh();
  };

  const approve = async () => {
    form.clearErrors();
    const parsed = approveSchema.safeParse(form.getValues());
    if (!parsed.success) {
      form.setError("decisionNote", {
        message: parsed.error.issues[0]?.message ?? "Check the note",
      });
      return;
    }
    const result = await approveCorrectionAction(correction.id, form.getValues());
    if (result.ok) return done("approved");
    failed(result.error);
  };

  const reject = () =>
    startReject(async () => {
      form.clearErrors();
      const parsed = rejectSchema.safeParse(form.getValues());
      if (!parsed.success) {
        form.setError(
          "decisionNote",
          { message: "Explain why in at least 10 characters" },
          { shouldFocus: true },
        );
        return;
      }
      const result = await rejectCorrectionAction(correction.id, parsed.data);
      if (result.ok) return done("rejected");
      failed(result.error);
    });

  return (
    <div className="flex flex-col gap-4">
      {rootError && (
        <Alert variant="destructive">
          <AlertDescription>{rootError}</AlertDescription>
        </Alert>
      )}
      <TextareaField
        control={form.control}
        name="decisionNote"
        label="Note to the employee"
        description="Optional when approving; required when rejecting."
        maxLength={1000}
        rows={3}
      />
      <div className="flex flex-wrap gap-2">
        <Button className="h-11" onClick={() => setConfirmOpen(true)} disabled={isRejecting}>
          <CheckIcon aria-hidden />
          Approve
        </Button>
        <Button variant="outline" className="h-11" onClick={reject} disabled={isRejecting}>
          <XIcon aria-hidden />
          {isRejecting ? "Rejecting…" : "Reject"}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Approve this correction?"
        description={`${correction.employee.fullName}'s record for this day becomes ${resultText}. This can't be undone; a later change needs a new request.`}
        confirmLabel="Yes, approve"
        pendingLabel="Approving…"
        onConfirm={approve}
      />
    </div>
  );
}
