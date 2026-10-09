// Fixed locale and time zone, so server and client renders always match
// (docs/05-server-client-boundary.md#hydration-rules).

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
});
const date = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
const month = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** 123456 cents → "$1,234.56" */
export const formatCents = (cents: number) => currency.format(cents / 100);

/** 123456 cents → "$1.2K" */
export const formatCentsCompact = (cents: number) => compactCurrency.format(cents / 100);

/** "2026-03-04" → "Mar 4, 2026" */
export const formatDate = (isoDate: string) => date.format(new Date(`${isoDate}T00:00:00Z`));

/** "2026-03" → "Mar" */
export const formatMonth = (isoMonth: string) => month.format(new Date(`${isoMonth}-01T00:00:00Z`));

/** "2026-10-09T08:13:14.000Z" → "Oct 9, 2026, 8:13 AM UTC" */
export const formatDateTime = (isoDateTime: string) =>
  `${dateTime.format(new Date(isoDateTime))} UTC`;

/** 1536 → "1.5 KB" */
export function formatBytes(bytes: number): string {
  const units = ["bytes", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? value : value.toFixed(1).replace(/\.0$/, "")} ${units[unit]}`;
}
