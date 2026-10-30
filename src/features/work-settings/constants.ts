/** ISO weekdays, as the API numbers them (1 = Monday). */
export const WEEKDAYS = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
  { value: 7, short: "Sun", long: "Sunday" },
] as const;

/**
 * The zones the pilot offers (Indonesia's three). The current zone is always added
 * too, so an organization set up elsewhere can keep its own.
 */
export const TIME_ZONES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"] as const;

export const SCHEDULE_STATE_LABEL = {
  past: "Ended",
  current: "In force",
  upcoming: "Upcoming",
} as const;
