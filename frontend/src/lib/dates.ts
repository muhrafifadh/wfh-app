// Calendar arithmetic on dates ("2026-10-30") and months ("2026-10"), in UTC so the
// results never depend on the server's or the browser's zone. "Today" always comes from
// the server (the organization's workDate).

const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

const toUtcDate = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);
const fromUtcDate = (date: Date) => date.toISOString().slice(0, 10);

/** A real calendar date ("2026-02-30" is not). */
export const isIsoDate = (value: string) =>
  DATE.test(value) && fromUtcDate(toUtcDate(value)) === value;
export const isIsoMonth = (value: string) => MONTH.test(value);

export const addDays = (isoDate: string, days: number) => {
  const date = toUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtcDate(date);
};

export const daysBetween = (from: string, to: string) =>
  Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / 86_400_000);

export const monthOf = (isoDate: string) => isoDate.slice(0, 7);
export const firstDayOf = (month: string) => `${month}-01`;
export const lastDayOf = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return fromUtcDate(new Date(Date.UTC(year, monthNumber, 0)));
};

export const shiftMonth = (month: string, by: number) => {
  const [year, monthNumber] = month.split("-").map(Number) as [number, number];
  return fromUtcDate(new Date(Date.UTC(year, monthNumber - 1 + by, 1))).slice(0, 7);
};

/** Mon = 1 … Sun = 7, like the schedule's working days. */
export const isoWeekday = (isoDate: string) => toUtcDate(isoDate).getUTCDay() || 7;
