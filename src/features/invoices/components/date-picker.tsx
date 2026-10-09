"use client";

import { useState } from "react";

import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "2026-03-04" → a Date at local midnight, so the calendar highlights the right day. */
function fromIsoDate(value: string): Date | undefined {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : undefined;
}

/** A local Date → "2026-03-04", without the UTC shift toISOString() would add. */
function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

type DatePickerProps = Omit<React.ComponentProps<typeof Button>, "value" | "onChange"> & {
  /** ISO date ("YYYY-MM-DD"), or "" for none. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

/** shadcn date picker (Popover + Calendar) that reads and writes ISO date strings. */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  ...buttonProps
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = fromIsoDate(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
          {...buttonProps}
        >
          <CalendarIcon aria-hidden />
          {selected ? formatDate(value) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          onSelect={(date) => {
            onChange(date ? toIsoDate(date) : "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
