// Matches the backend list response (backend docs/05-api-design.md).
export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};
