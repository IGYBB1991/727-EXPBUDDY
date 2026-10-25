"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatMonth } from "@/lib/months";
import type { Slice } from "@/lib/dashboard";
import { ChartTooltip } from "./chart-tooltip";

const compact = new Intl.NumberFormat("en-SG", { notation: "compact", maximumFractionDigits: 1 });

// Bars per month, stacked by category, with a legend underneath.
export function StackedMonthsChart({
  months,
  series,
  values,
  height = 220,
}: {
  months: string[];
  series: Pick<Slice, "key" | "name" | "color">[];
  values: Record<string, number>[];
  height?: number;
}) {
  const data = months.map((month, i) => ({ month, ...values[i] }));
  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="month"
              tickFormatter={(m: string) => formatMonth(m, "short").split(" ")[0]}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              width={44}
              tickFormatter={(v: number) => `$${compact.format(v)}`}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={<ChartTooltip formatLabel={(m) => formatMonth(m)} showTotal />}
            />
            {series.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId="total"
                fill={s.color}
                stroke="var(--card)"
                strokeWidth={1}
                radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={36}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend series={series} />
    </div>
  );
}

export function Legend({ series }: { series: Pick<Slice, "key" | "name" | "color">[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
          {s.name}
        </li>
      ))}
    </ul>
  );
}
