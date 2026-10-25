import Link from "next/link";
import { AlertCircle, ChevronRight } from "lucide-react";

import { BudgetBar } from "@/components/budget-bar";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { StackedMonthsChart } from "@/components/dashboard/stacked-months-chart";
import { StatTile } from "@/components/dashboard/stat-tile";
import { PageHeader } from "@/components/layout/page-header";
import { MonthPicker } from "@/components/month-picker";
import { OwnerFilterControl } from "@/components/owner-filter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardData } from "@/lib/dashboard";
import { formatSGD } from "@/lib/money";
import { addMonths, formatMonth } from "@/lib/months";
import type { OwnerParam } from "@/lib/owner-filter";
import { cn } from "@/lib/utils";

// Everything the dashboard shows, given the numbers already worked out.
export function DashboardView({
  d,
  owner,
  historyMonths,
  needsReview,
  partnerName,
  params,
}: {
  d: DashboardData;
  owner: OwnerParam;
  historyMonths: number;
  needsReview: number;
  partnerName: string | null;
  params: Record<string, string | string[] | undefined>;
}) {
  const month = d.month;
  const budgetLeft = d.totalBudget - d.budgetedSpent;
  const foodChange = d.food.total - d.food.previousTotal;
  const maxMerchant = d.topMerchants[0]?.total ?? 0;
  const rangeHref = (range: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (typeof value === "string") next.set(key, value);
    if (range === 12) next.set("range", "12");
    else next.delete("range");
    return `/?${next.toString()}`;
  };

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <MonthPicker month={month} />
        <div className="max-w-full overflow-x-auto">
          <OwnerFilterControl value={owner} partnerName={partnerName} />
        </div>
      </div>

      {needsReview > 0 && (
        <Link
          href="/transactions?review=1"
          className="mb-4 flex items-center gap-3 rounded-lg border border-warning/50 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/20"
        >
          <AlertCircle className="size-4 shrink-0" />
          <span className="flex-1">
            <strong>{needsReview}</strong> transaction{needsReview === 1 ? "" : "s"} need{needsReview === 1 ? "s" : ""}{" "}
            a category check
          </span>
          <ChevronRight className="size-4" />
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={`Spent in ${formatMonth(month, "short")}`} value={formatSGD(d.totalSpent, { whole: true })} />
        <StatTile
          label="Food"
          value={formatSGD(d.food.total, { whole: true })}
          detail={
            d.totalSpent > 0 ? `${Math.round((d.food.total / d.totalSpent) * 100)}% of spending` : undefined
          }
        />
        <StatTile
          label="vs last month"
          value={
            d.change === null ? "–" : `${d.change > 0 ? "+" : ""}${Math.round(d.change * 100)}%`
          }
          tone={d.change === null ? "default" : d.change > 0 ? "bad" : "good"}
          detail={
            d.change === null
              ? "No data for last month"
              : `${d.totalSpent >= d.previousTotal ? "+" : "−"}${formatSGD(Math.abs(d.totalSpent - d.previousTotal), { whole: true })}`
          }
        />
        <StatTile
          label="Budget left"
          value={d.totalBudget > 0 ? formatSGD(budgetLeft, { whole: true }) : "No budget"}
          tone={d.totalBudget === 0 ? "default" : budgetLeft < 0 ? "bad" : "default"}
          detail={
            d.totalBudget > 0 ? (
              `of ${formatSGD(d.totalBudget, { whole: true })} budgeted`
            ) : (
              <Link href="/budgets" className="text-primary underline-offset-4 hover:underline">
                Set budgets
              </Link>
            )
          }
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Food</CardTitle>
            <CardDescription>
              {formatSGD(d.food.total)} this month
              {d.food.previousTotal > 0 &&
                ` · ${foodChange >= 0 ? "up" : "down"} ${formatSGD(Math.abs(foodChange), { whole: true })} from ${formatMonth(addMonths(month, -1), "short")}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <ul className="grid grid-cols-3 gap-3">
              {d.food.parts.map((part) => (
                <li key={part.key} className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: part.color }} />
                    <span className="truncate">{part.name}</span>
                  </span>
                  <span className="text-lg font-semibold">{formatSGD(part.total, { whole: true })}</span>
                </li>
              ))}
            </ul>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Last 6 months</p>
              <StackedMonthsChart
                months={d.food.trend.map((t) => t.month)}
                series={d.food.parts}
                values={d.food.trend.map((t) => Object.fromEntries(d.food.parts.map((p) => [p.key, t.values[p.key] ?? 0])))}
                height={180}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By category</CardTitle>
            <CardDescription>{formatMonth(month)}</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonut slices={d.byCategory} total={d.totalSpent} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>Spending by month</CardTitle>
            <CardDescription>Your biggest categories over the last {historyMonths} months</CardDescription>
          </div>
          <div className="flex rounded-md border p-0.5 text-xs">
            {[6, 12].map((range) => (
              <Link
                key={range}
                href={rangeHref(range)}
                className={cn(
                  "rounded px-2 py-1 whitespace-nowrap text-muted-foreground",
                  historyMonths === range && "bg-secondary font-medium text-foreground",
                )}
              >
                {range} mo
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <StackedMonthsChart months={d.history.months} series={d.history.series} values={d.history.values} height={240} />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Budgets</CardTitle>
            <Link href={`/budgets?month=${month}`} className="text-sm text-primary underline-offset-4 hover:underline">
              Edit
            </Link>
          </CardHeader>
          <CardContent>
            {d.budgets.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No budgets for {formatMonth(month)}.{" "}
                <Link href={`/budgets?month=${month}`} className="text-primary underline-offset-4 hover:underline">
                  Set some
                </Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {d.budgets.map((b) => (
                  <li key={b.category.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: b.category.color }} />
                        <span className="truncate">{b.category.name}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {formatSGD(b.spent, { whole: true })} / {formatSGD(b.budget, { whole: true })}
                      </span>
                    </div>
                    <BudgetBar spent={b.spent} budget={b.budget} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top merchants</CardTitle>
            <CardDescription>{formatMonth(month)}</CardDescription>
          </CardHeader>
          <CardContent>
            {d.topMerchants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No spending this month yet.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {d.topMerchants.map((m, i) => (
                  <li key={m.merchant} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                        <span className="truncate">{m.merchant}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">×{m.count}</span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">{formatSGD(m.total)}</span>
                    </div>
                    <div className="ml-6 h-1.5 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${maxMerchant > 0 ? (m.total / maxMerchant) * 100 : 0}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
