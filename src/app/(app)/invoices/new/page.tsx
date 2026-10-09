import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateInvoiceForm } from "@/features/invoices/components/create-invoice-form";

export const metadata: Metadata = { title: "New invoice" };

export default function NewInvoicePage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Invoice details</CardTitle>
          <CardDescription>
            An example form: it validates on the client and on the server, but nothing is saved yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateInvoiceForm />
        </CardContent>
      </Card>
    </>
  );
}
