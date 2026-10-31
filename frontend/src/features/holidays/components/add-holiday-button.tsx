"use client";

import { useState } from "react";

import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HolidayFormDialog } from "@/features/holidays/components/holiday-form-dialog";

export function AddHolidayButton({
  today,
  defaultDate,
  label = "Add holiday",
}: {
  today: string;
  defaultDate?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden />
        {label}
      </Button>
      <HolidayFormDialog
        open={open}
        onOpenChange={setOpen}
        today={today}
        defaultDate={defaultDate}
      />
    </>
  );
}
