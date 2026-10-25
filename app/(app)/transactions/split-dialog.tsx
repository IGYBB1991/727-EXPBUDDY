"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";

import { CategorySelect } from "@/components/category-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatSGD, roundMoney, sumMoney } from "@/lib/money";
import type { Category, Transaction } from "@/lib/types";
import { splitAction } from "./actions";

type Part = { key: number; categoryId: string | null; amount: string };

// Splits one transaction (say, a supermarket bill with household items)
// into several categories.
export function SplitDialog({
  transaction,
  categories,
  onClose,
}: {
  transaction: Transaction;
  categories: Category[];
  onClose: () => void;
}) {
  const [parts, setParts] = useState<Part[]>([
    { key: 1, categoryId: transaction.category_id, amount: "" },
    { key: 2, categoryId: null, amount: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const entered = sumMoney(parts.map((p) => Number(p.amount) || 0));
  const remaining = roundMoney(transaction.amount - entered);

  function update(key: number, change: Partial<Part>) {
    setParts(parts.map((p) => (p.key === key ? { ...p, ...change } : p)));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await splitAction(
        transaction.id,
        parts.map((p) => ({ categoryId: p.categoryId, amount: Number(p.amount) || 0 })),
      );
      if (result.ok) onClose();
      else setError(result.error);
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Split transaction</DialogTitle>
          <DialogDescription>
            {transaction.merchant ?? transaction.description} · {formatSGD(transaction.amount)}
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col gap-2">
          {parts.map((part) => (
            <li key={part.key} className="flex items-center gap-2">
              <CategorySelect
                categories={categories}
                value={part.categoryId}
                onChange={(categoryId) => update(part.key, { categoryId })}
                className="flex-1"
                aria-label="Category"
              />
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={part.amount}
                onChange={(e) => update(part.key, { amount: e.target.value })}
                className="w-28 text-right tabular-nums"
                aria-label="Amount"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={parts.length <= 2}
                onClick={() => setParts(parts.filter((p) => p.key !== part.key))}
                aria-label="Remove part"
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between text-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setParts([...parts, { key: Math.max(...parts.map((p) => p.key)) + 1, categoryId: null, amount: "" }])}
          >
            <Plus />
            Add part
          </Button>
          <span className={remaining === 0 ? "text-primary" : "text-muted-foreground"}>
            {remaining === 0 ? "Adds up" : remaining > 0 ? `${formatSGD(remaining)} left` : `${formatSGD(-remaining)} too much`}
          </span>
        </div>
        {remaining > 0 && (
          <Button
            variant="link"
            size="sm"
            className="self-start px-0"
            onClick={() => {
              const last = parts.at(-1)!;
              update(last.key, { amount: roundMoney((Number(last.amount) || 0) + remaining).toFixed(2) });
            }}
          >
            Put the rest in the last part
          </Button>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || remaining !== 0}>
            Split
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
