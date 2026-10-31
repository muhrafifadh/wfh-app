import { z } from "zod";

import { DIVISION_CODE_PATTERN, DIVISION_STATUSES } from "@/features/divisions/constants";

// Backend response shapes (backend src/modules/divisions/dto), checked in contract.ts

export const divisionSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  status: z.enum(DIVISION_STATUSES),
  activeEmployeeCount: z.int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Division = z.infer<typeof divisionSchema>;

export const divisionListSchema = z.object({
  items: z.array(divisionSchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
});

// What we send

export const divisionIdSchema = z.uuid();

export const divisionFormSchema = z.object({
  // UX_FLOWS.md §13: normalized to uppercase
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(DIVISION_CODE_PATTERN, "Use 2–32 letters, digits or dashes, e.g. ENG or OPS-2"),
  name: z.string().trim().min(1, "Enter a name").max(120, "Use at most 120 characters"),
});
export type DivisionFormInput = z.infer<typeof divisionFormSchema>;
