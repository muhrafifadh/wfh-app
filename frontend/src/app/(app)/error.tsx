"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { reportError } from "@/lib/logger";

/** Errors from (app) pages render inside the sidebar shell, so navigation still works. */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    reportError(error, { digest: error.digest });
  }, [error]);

  return (
    <div role="alert" className="grid flex-1 place-items-center py-16 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          Please try again. If it keeps happening, contact support.
        </p>
        {error.digest && <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>}
        <Button onClick={() => retry()}>Try again</Button>
      </div>
    </div>
  );
}
