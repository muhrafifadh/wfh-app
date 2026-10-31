"use client";

import { useState } from "react";

import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DivisionFormDialog } from "@/features/divisions/components/division-form-dialog";

export function AddDivisionButton({ label = "Add division" }: { label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon aria-hidden />
        {label}
      </Button>
      <DivisionFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
