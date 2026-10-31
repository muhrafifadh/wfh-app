export const PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 300;

/** Sort direction in list URLs (`?order=desc`); the API takes "-field" for descending. */
export const SORT_ORDERS = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/** The backend's largest page size: enough for every option in a select. */
export const OPTIONS_PAGE_SIZE = 100;
