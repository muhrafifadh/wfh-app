"use client";

import { useState, useTransition } from "react";

import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatLongDate } from "@/features/attendance/format";
import {
  declinePhotoRequestAction,
  disclosePhotoAction,
} from "@/features/attendance-verification/actions";
import type { PhotoRequest } from "@/features/attendance-verification/schemas";

/**
 * Decision V12: confirm who is asking, record how, then share the photo with them. The
 * request and the disclosure are both audited.
 */
export function PhotoRequests({ requests }: { requests: PhotoRequest[] }) {
  if (requests.length === 0) {
    return (
      <EmptyState title="No open requests" description="Employees' photo requests show up here." />
    );
  }
  return (
    <ul className="grid gap-3">
      {requests.map((request) => (
        <PhotoRequestItem key={request.id} request={request} />
      ))}
    </ul>
  );
}

function PhotoRequestItem({ request }: { request: PhotoRequest }) {
  const [identityCheck, setIdentityCheck] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fieldId = `identity-${request.id}`;

  return (
    <li className="grid gap-2 rounded-md border p-3 text-sm">
      <p className="font-medium">
        {request.employee.fullName}, photo from {formatLongDate(request.workDate)}
      </p>
      {link ? (
        <p>
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline-offset-4 hover:underline"
          >
            Download the photo
          </a>{" "}
          to share with them. The link works for 15 minutes.
        </p>
      ) : (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              setError(null);
              const result = await disclosePhotoAction(request.id, { identityCheck });
              if (!result.ok) {
                setError(result.fieldErrors?.identityCheck?.[0] ?? result.error);
                return;
              }
              setLink(result.data.url);
            });
          }}
        >
          <Label htmlFor={fieldId}>How did you confirm it&apos;s them?</Label>
          <Input
            id={fieldId}
            value={identityCheck}
            maxLength={200}
            placeholder="e.g. Video call, compared with HR records"
            onChange={(event) => setIdentityCheck(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={`${fieldId}-help`}
          />
          <p id={`${fieldId}-help`} className="text-xs text-muted-foreground">
            {error ?? "Don't record ID numbers. This goes in the audit log."}
          </p>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={isPending}>
              Confirm and disclose
            </Button>
            <Button
              size="sm"
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await declinePhotoRequestAction(request.id);
                  if (!result.ok) toast.error(result.error);
                })
              }
            >
              Decline
            </Button>
          </div>
        </form>
      )}
    </li>
  );
}
