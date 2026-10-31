import { z } from "zod";

// Backend response shapes (backend src/modules/holidays/dto), checked in contract.ts

export const holidaySchema = z.object({
  id: z.string(),
  date: z.iso.date(),
  name: z.string(),
  createdBy: z.object({ id: z.string(), name: z.string() }),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Holiday = z.infer<typeof holidaySchema>;

export const holidayListSchema = z.object({
  items: z.array(holidaySchema),
  page: z.int(),
  pageSize: z.int(),
  total: z.int(),
});

// What we send

export const holidayIdSchema = z.uuid();

export const holidayFormSchema = z.object({
  date: z.iso.date("Choose a date"),
  name: z.string().trim().min(1, "Enter a name").max(160, "Use at most 160 characters"),
});
export type HolidayFormInput = z.infer<typeof holidayFormSchema>;
