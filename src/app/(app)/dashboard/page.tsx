import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { routes } from "@/config/routes";
import { InvoiceStats } from "@/features/invoices/components/invoice-stats";
import { RevenueChart } from "@/features/invoices/components/revenue-chart";
import { getMonthlyRevenue } from "@/features/invoices/queries";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const revenue = await getMonthlyRevenue();

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Badge variant="secondary">Example data</Badge>
      </div>

      <InvoiceStats />

      <Card>
        <CardHeader>
          <CardTitle>Revenue collected</CardTitle>
          <CardDescription>Paid invoices by month issued, 2026</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" asChild>
              <Link href={routes.invoices()}>View invoices</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <RevenueChart data={revenue} />
        </CardContent>
      </Card>
    </>
  );
}
