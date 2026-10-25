"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Scissors, Trash2, Undo2 } from "lucide-react";

import { Amount } from "@/components/amount";
import { CategorySelect } from "@/components/category-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/action-result";
import { formatDay } from "@/lib/months";
import type { Account, Category, Member, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  applyToMerchantAction,
  deleteTransactionAction,
  markCheckedAction,
  setCategoryAction,
  setNotesAction,
  undoSplitAction,
} from "./actions";
import { SplitDialog } from "./split-dialog";

type Offer = { transactionId: string; merchant: string; categoryName: string; others: number };

export function TransactionList({
  transactions,
  categories,
  accounts,
  members,
}: {
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  members: Member[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<string | null>(null);
  const [splitting, setSplitting] = useState<Transaction | null>(null);

  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const memberName = new Map(members.map((m) => [m.id, m.display_name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  function run<T>(action: () => Promise<ActionResult<T>>, onOk?: (data: T | undefined) => void) {
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
      else onOk?.(result.data);
    });
  }

  function changeCategory(tx: Transaction, categoryId: string | null) {
    setOffer(null);
    run(
      () => setCategoryAction(tx.id, categoryId),
      (data) => {
        if (data && categoryId && data.others > 0) {
          setOffer({ transactionId: tx.id, merchant: data.merchant, categoryName: categoryName.get(categoryId) ?? "", others: data.others });
        } else if (data && categoryId) {
          setInfo(`Saved. We'll put ${data.merchant} in ${categoryName.get(categoryId)} from now on.`);
        }
      },
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className="items-center py-10 text-center text-sm text-muted-foreground">
        No transactions match these filters.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {info && (
        <Alert>
          <AlertDescription>{info}</AlertDescription>
        </Alert>
      )}
      {offer && (
        <Alert className="border-primary/40">
          <AlertDescription className="flex flex-col gap-2">
            <p>
              Saved. We&apos;ll put <strong>{offer.merchant}</strong> in <strong>{offer.categoryName}</strong> from now
              on. Change the {offer.others} other transaction{offer.others === 1 ? "" : "s"} from this merchant too?
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () => applyToMerchantAction(offer.transactionId),
                    (count) => {
                      setOffer(null);
                      setInfo(`Updated ${count} transaction${count === 1 ? "" : "s"}.`);
                    },
                  )
                }
              >
                Yes, change all
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOffer(null)}>
                Just this one
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card className={cn("gap-0 py-0", pending && "opacity-80")}>
        <ul className="divide-y">
          {transactions.map((tx) => {
            const expanded = open === tx.id;
            return (
              <li key={tx.id} className={cn("px-4 py-3", tx.needs_review && "bg-warning/10")}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <button
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    onClick={() => setOpen(expanded ? null : tx.id)}
                    aria-expanded={expanded}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-medium break-words">{tx.merchant ?? tx.description}</p>
                        <Amount amount={tx.amount} direction={tx.direction} className="text-sm sm:hidden" />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                        <span>{formatDay(tx.date)}</span>
                        <span>· {tx.owner_id ? memberName.get(tx.owner_id) ?? "?" : "Joint"}</span>
                        {tx.account_id && <span>· {accountName.get(tx.account_id)}</span>}
                        {tx.needs_review && <Badge variant="warning">Please check</Badge>}
                        {tx.split_parent_id && <Badge variant="secondary">Split</Badge>}
                        {tx.notes && <span className="truncate italic">· {tx.notes}</span>}
                      </div>
                    </div>
                    <ChevronDown
                      className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
                    />
                  </button>
                  <Amount amount={tx.amount} direction={tx.direction} className="hidden w-28 text-right text-sm sm:block" />
                  <CategorySelect
                    categories={categories}
                    value={tx.category_id}
                    onChange={(categoryId) => changeCategory(tx, categoryId)}
                    disabled={pending}
                    className="w-full sm:w-56"
                    aria-label={`Category for ${tx.merchant ?? tx.description}`}
                  />
                </div>

                {expanded && (
                  <div className="mt-3 flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
                    {tx.merchant && <p className="text-xs text-muted-foreground">From the bank: {tx.description}</p>}
                    <Textarea
                      defaultValue={tx.notes ?? ""}
                      placeholder="Add a note"
                      rows={2}
                      onBlur={(e) =>
                        e.target.value.trim() !== (tx.notes ?? "") && run(() => setNotesAction(tx.id, e.target.value))
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      {tx.needs_review && tx.category_id && (
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => markCheckedAction(tx.id))}>
                          <Check />
                          Category is right
                        </Button>
                      )}
                      {tx.split_parent_id ? (
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => undoSplitAction(tx.id))}>
                          <Undo2 />
                          Undo split
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => setSplitting(tx)}>
                          <Scissors />
                          Split
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={pending}
                        onClick={() =>
                          confirm("Delete this transaction? This can't be undone.") &&
                          run(() => deleteTransactionAction(tx.id))
                        }
                      >
                        <Trash2 />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {splitting && (
        <SplitDialog transaction={splitting} categories={categories} onClose={() => setSplitting(null)} />
      )}
    </div>
  );
}
