"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MonthlyRevenue } from "@/features/invoices/queries";
import { formatCents, formatCentsCompact, formatMonth } from "@/lib/format";

const chartConfig = {
  amount: { label: "Revenue", color: "var(--chart-2)" },
} satisfies ChartConfig;

/** One series, so no legend: the card title names it. */
export function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  return (
    <>
      <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full" aria-hidden>
        <BarChart data={data} margin={{ left: 0, right: 0, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={formatMonth}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(value: number) => formatCentsCompact(value)}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(month) => (typeof month === "string" ? formatMonth(month) : month)}
                formatter={(value) => formatCents(Number(value))}
              />
            }
          />
          <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ChartContainer>

      {/* The same numbers for screen readers (docs/15-accessibility.md). */}
      <table className="sr-only">
        <caption>Revenue collected by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.month}>
              <th scope="row">{formatMonth(row.month)}</th>
              <td>{formatCents(row.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
