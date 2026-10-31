"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DASHBOARD_POLL_MS } from "@/features/reports/constants";
import { formatTimeIn, timeZoneLabel } from "@/lib/time-zone";

/**
 * UX_FLOWS.md §6.4 — "Last updated" from the server's time, a Refresh button, and a
 * re-render every minute while the tab is visible (and on returning to it).
 */
export function RefreshBar({ serverTime, timeZone }: { serverTime: string; timeZone: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    }, DASHBOARD_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>
        Last updated {formatTimeIn(serverTime, timeZone)} {timeZoneLabel(timeZone)}
      </span>
      <Button variant="ghost" size="sm" onClick={refresh} disabled={isPending}>
        <RefreshCwIcon aria-hidden className={isPending ? "animate-spin" : undefined} />
        Refresh
      </Button>
    </div>
  );
}
