// DOMAIN_RULES.md §5 — work dates and schedule times live in an IANA zone; instants
// are UTC. Built on Intl so it follows the runtime's tz database (DST included).

/** "YYYY-MM-DD", a calendar date with no zone. */
export type LocalDate = string;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
};

/**
 * True for IANA names the runtime knows, e.g. "Asia/Jakarta" or "UTC". Fixed offsets
 * such as "+07:00" are rejected (§5.1: a zone name, not an offset).
 */
export const isValidTimeZone = (timeZone: string): boolean => {
  if (!/^[A-Za-z]/.test(timeZone)) return false;
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
};

/** The wall-clock fields of an instant in a zone. */
const wallClock = (instant: Date, timeZone: string) => {
  const parts = Object.fromEntries(
    formatterFor(timeZone)
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
};

/** How far the zone's wall clock is ahead of UTC at this instant. */
const offsetMs = (instant: Date, timeZone: string): number => {
  const w = wallClock(instant, timeZone);
  const wallAsUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return wallAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
};

/** The calendar date of an instant in a zone (the work date, §5.2). */
export const localDateOf = (instant: Date, timeZone: string): LocalDate => {
  const w = wallClock(instant, timeZone);
  return `${String(w.year).padStart(4, "0")}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
};

/** The instant on the zone's wall clock with its offset, e.g. "2026-11-02T09:05:12+07:00". */
export const formatZoned = (instant: Date, timeZone: string): string => {
  const w = wallClock(instant, timeZone);
  const offsetMinutes = Math.round(offsetMs(instant, timeZone) / 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  return (
    `${localDateOf(instant, timeZone)}T${pad(w.hour)}:${pad(w.minute)}:${pad(w.second)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
};

/**
 * The instant when the wall clock in `timeZone` shows `date` + `msOfDay`.
 * A time shown twice (clocks go back) is the earlier instant; a time skipped by a
 * jump forward is shifted past the jump (02:30 → 03:30).
 */
export const zonedToUtc = (date: LocalDate, msOfDay: number, timeZone: string): Date => {
  const wallAsUtc = Date.parse(`${date}T00:00:00.000Z`) + msOfDay;
  // The offsets in force a day either side cover any transition near this time
  const before = offsetMs(new Date(wallAsUtc - MS_PER_DAY), timeZone);
  const after = offsetMs(new Date(wallAsUtc + MS_PER_DAY), timeZone);
  const matches = [before, after]
    .map((offset) => wallAsUtc - offset)
    .filter((instant) => wallAsUtc - instant === offsetMs(new Date(instant), timeZone));
  return new Date(matches.length > 0 ? Math.min(...matches) : wallAsUtc - before);
};

export const addDays = (date: LocalDate, days: number): LocalDate =>
  new Date(Date.parse(`${date}T00:00:00.000Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export const isoWeekday = (date: LocalDate): number => {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
};

// Times of day, as milliseconds since local midnight

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?$/;

/** "09:00", "09:00:00" or "23:59:59.999" → ms since midnight; null if malformed. */
export const parseTimeOfDay = (value: string): number | null => {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  const [, h, m, s = "0", ms = "0"] = match;
  return ((Number(h) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(ms.padEnd(3, "0"));
};

/** ms since midnight → "HH:MM:SS", or "HH:MM:SS.sss" with millisecond precision. */
export const formatTimeOfDay = (
  msOfDay: number,
  precision: "seconds" | "milliseconds" = "seconds",
) => new Date(msOfDay).toISOString().slice(11, precision === "seconds" ? 19 : 23);

/** The Date Prisma uses for a `time` column (1970-01-01, UTC) ↔ ms since midnight. */
export const fromTimeColumn = (value: Date): number => value.getTime() % MS_PER_DAY;
export const toTimeColumn = (msOfDay: number): Date => new Date(msOfDay);

/** The Date Prisma uses for a `date` column (midnight UTC) ↔ "YYYY-MM-DD". */
export const toDateColumn = (date: LocalDate): Date => new Date(`${date}T00:00:00.000Z`);
export const fromDateColumn = (date: Date): LocalDate => date.toISOString().slice(0, 10);
