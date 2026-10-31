"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { TrendPoint } from "@/features/reports/schemas";
import { formatDayDate } from "@/lib/format";

/**
 * Stacked bottom to top in this order. The colours are their own validated set
 * (globals.css --trend-*), not the status badges: those fail as adjacent chart fills
 * for colour-vision deficiency. Identity never rests on colour alone: there's a
 * legend, a tooltip and a table.
 */
const SERIES = ["present", "late", "incomplete", "absent"] as const;

const config = {
  present: { label: "Present", color: "var(--trend-present)" },
  late: { label: "Late", color: "var(--trend-late)" },
  incomplete: { label: "Incomplete", color: "var(--trend-incomplete)" },
  absent: { label: "Absent", color: "var(--trend-absent)" },
} satisfies ChartConfig;

const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const tick = (date: string) => shortDate.format(new Date(`${date}T00:00:00Z`));

/**
 * UX_FLOWS.md §6.3 / §11.2 — daily present, late, incomplete and absent counts. Only
 * working days are drawn, so weekends don't read as zero attendance.
 */
export function TrendChart({ points, title }: { points: TrendPoint[]; title: string }) {
  const days = points.filter((point) => point.isWorkingDay);

  if (days.length === 0) {
    return <p className="text-sm text-muted-foreground">No working days in this range.</p>;
  }

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="sr-only">{title}</figcaption>
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart
          data={days}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          barCategoryGap={2}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={tick}
          />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
          <ChartTooltip
            cursor={{ fillOpacity: 0.4 }}
            content={
              <ChartTooltipContent labelFormatter={(value) => formatDayDate(String(value))} />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {SERIES.map((key, index) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="day"
              fill={`var(--color-${key})`}
              // A 2px surface gap between stacked segments
              stroke="var(--background)"
              strokeWidth={2}
              radius={index === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Show as a table
        </summary>
        <div className="mt-2 max-h-80 overflow-auto rounded-lg border">
          <table className="w-full text-left tabular-nums">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-background text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="p-2 font-medium">
                  Date
                </th>
                {SERIES.map((key) => (
                  <th key={key} scope="col" className="p-2 font-medium">
                    {config[key].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.date} className="border-t">
                  <th scope="row" className="p-2 font-normal">
                    {formatDayDate(day.date)}
                  </th>
                  {SERIES.map((key) => (
                    <td key={key} className="p-2">
                      {day[key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
