"use client";

import { formatSGD } from "@/lib/money";

type Entry = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number };

// The hover card for charts: a title and one line per series, biggest first.
export function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
  showTotal = false,
}: {
  active?: boolean;
  payload?: Entry[];
  label?: string | number;
  formatLabel?: (label: string) => string;
  showTotal?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => Number(p.value) > 0).sort((a, b) => Number(b.value) - Number(a.value));
  const total = rows.reduce((sum, p) => sum + Number(p.value), 0);
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {label !== undefined && (
        <p className="mb-1 font-medium">{formatLabel ? formatLabel(String(label)) : label}</p>
      )}
      <ul className="flex flex-col gap-1">
        {rows.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
            <span className="tabular-nums">{formatSGD(Number(p.value))}</span>
          </li>
        ))}
      </ul>
      {showTotal && rows.length > 1 && (
        <p className="mt-1 flex justify-between border-t pt-1 font-medium">
          <span>Total</span>
          <span className="tabular-nums">{formatSGD(total)}</span>
        </p>
      )}
    </div>
  );
}
