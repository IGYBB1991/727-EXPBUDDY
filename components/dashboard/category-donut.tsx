"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { Slice } from "@/lib/dashboard";
import { formatSGD } from "@/lib/money";
import { ChartTooltip } from "./chart-tooltip";

// Spending by category as a ring, with the total in the middle and a list of
// every slice (with amounts and shares) beside it.
export function CategoryDonut({ slices, total }: { slices: Slice[]; total: number }) {
  if (slices.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No spending this month yet.</p>;
  }
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative size-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="name"
              innerRadius="64%"
              outerRadius="100%"
              paddingAngle={slices.length > 1 ? 2 : 0}
              stroke="var(--card)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.key} fill={s.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">Spent</span>
          <span className="text-base font-semibold">{formatSGD(total, { whole: true })}</span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2 text-sm">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="truncate">{s.name}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
              <span className="text-xs text-muted-foreground">{total > 0 ? Math.round((s.total / total) * 100) : 0}%</span>
              <span className="font-medium">{formatSGD(s.total)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
