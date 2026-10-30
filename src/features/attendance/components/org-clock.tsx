"use client";

import { useState, useSyncExternalStore } from "react";

import { formatClock } from "@/features/attendance/format";

const subscribe = (onTick: () => void) => {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
};

/**
 * UX_FLOWS.md §7.1 — a running estimate of the organization's time, seeded from the
 * server's `serverTime`. Display only: the backend decides every timestamp. Give it a
 * `key` of the server time so each refresh resyncs it.
 */
export function OrgClock({ serverTime, timeZone }: { serverTime: string; timeZone: string }) {
  // How far the browser's clock is from the server's, measured once per seed
  const [offset] = useState(() => Date.parse(serverTime) - Date.now());
  const second = useSyncExternalStore(
    subscribe,
    () => Math.floor((Date.now() + offset) / 1000),
    () => null,
  );
  const now = second === null ? serverTime : new Date(second * 1000).toISOString();

  return (
    <time dateTime={now} className="tabular-nums">
      {formatClock(now, timeZone)}
    </time>
  );
}
