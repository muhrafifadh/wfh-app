"use client";

import { useEffect } from "react";

import { reportError } from "@/lib/logger";

import "./globals.css";

// Replaces the root layout when it throws, so it renders its own <html>/<body>.
export default function GlobalError({
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
    <html lang="en">
      <body className="grid min-h-dvh place-items-center bg-background p-4 text-center text-foreground">
        <main role="alert" className="flex flex-col items-center gap-3">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          {error.digest && (
            <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={() => retry()}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
