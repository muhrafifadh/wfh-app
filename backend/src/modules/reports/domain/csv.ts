// DOMAIN_RULES.md §13.1 — CSV for spreadsheets: RFC 4180 quoting, a BOM so Excel reads
// UTF-8, and cells that a spreadsheet would run as a formula neutralized.

export const CSV_BOM = "﻿";

const FORMULA_START = /^[=+\-@\t\r]/;

/** One cell: formula-like text gets a leading apostrophe; then quoted if needed. */
export const csvCell = (value: string | number | boolean | null): string => {
  if (value === null) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export const csvLine = (cells: (string | number | boolean | null)[]): string =>
  `${cells.map(csvCell).join(",")}\r\n`;
