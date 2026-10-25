"use client";

import { useState, useTransition } from "react";
import { Copy } from "lucide-react";

import { BudgetBar } from "@/components/budget-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatSGD, sumMoney } from "@/lib/money";
import { addMonths, formatMonth } from "@/lib/months";
import type { Category } from "@/lib/types";
import { copyPreviousMonthAction, setBudgetAction } from "./actions";

export type BudgetRow = { category: Category; budget: number | null; spent: number };

export function BudgetEditor({
  month,
  rows,
  uncategorized,
}: {
  month: string;
  rows: BudgetRow[];
  uncategorized: number;
}) {
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const totalBudget = sumMoney(rows.map((r) => r.budget ?? 0));
  const totalSpent = sumMoney(rows.map((r) => r.spent).concat(uncategorized));
  const previous = formatMonth(addMonths(month, -1));

  function copyPrevious() {
    if (rows.some((r) => r.budget !== null) && !confirm(`Replace this month's budgets with ${previous}'s?`)) return;
    setMessage(null);
    startTransition(async () => {
      const result = await copyPreviousMonthAction(month);
      if (!result.ok) setMessage({ kind: "error", text: result.error });
      else if (result.data === 0) setMessage({ kind: "info", text: `${previous} has no budgets to copy.` });
      else setMessage({ kind: "info", text: `Copied ${result.data} budgets from ${previous}.` });
    });
  }

  function save(categoryId: string, value: string) {
    setMessage(null);
    startTransition(async () => {
      const result = await setBudgetAction(month, categoryId, value);
      if (!result.ok) setMessage({ kind: "error", text: result.error });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Total for {formatMonth(month)}</CardTitle>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatSGD(totalSpent)}{" "}
              <span className="text-base font-normal text-muted-foreground">
                of {formatSGD(totalBudget)}
              </span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={copyPrevious} disabled={pending}>
            <Copy />
            Copy {formatMonth(addMonths(month, -1), "short")}
          </Button>
        </CardHeader>
        <CardContent>
          <BudgetBar spent={totalSpent} budget={totalBudget} />
          <p className="mt-2 text-sm text-muted-foreground">
            {totalBudget === 0
              ? "No budgets set yet. Type an amount next to a category below."
              : totalSpent <= totalBudget
                ? `${formatSGD(totalBudget - totalSpent)} left`
                : `${formatSGD(totalSpent - totalBudget)} over budget`}
          </p>
        </CardContent>
      </Card>

      {message && (
        <Alert variant={message.kind === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Card className="py-2">
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.category.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: row.category.color }} />
                    <span className="truncate font-medium">{row.category.name}</span>
                  </div>
                  <p className="mt-0.5 pl-5 text-sm text-muted-foreground tabular-nums">
                    Spent {formatSGD(row.spent)}
                  </p>
                </div>
                <div className="relative w-28 shrink-0">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    inputMode="decimal"
                    aria-label={`Budget for ${row.category.name}`}
                    defaultValue={row.budget === null ? "" : row.budget.toFixed(2)}
                    placeholder="None"
                    className="pl-6 text-right tabular-nums"
                    onBlur={(e) => {
                      const before = row.budget === null ? "" : row.budget.toFixed(2);
                      if (e.target.value.trim() !== before) save(row.category.id, e.target.value);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                  />
                </div>
              </div>
              {row.budget !== null && <BudgetBar spent={row.spent} budget={row.budget} />}
            </li>
          ))}
          {uncategorized !== 0 && (
            <li className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
              <span>Not yet categorized</span>
              <span className="tabular-nums">{formatSGD(uncategorized)}</span>
            </li>
          )}
        </ul>
      </Card>
    </div>
  );
}
