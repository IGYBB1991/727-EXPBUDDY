"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";

import { CategorySelect } from "@/components/category-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { OwnerChoice } from "@/lib/db/members";
import type { Category } from "@/lib/types";
import { addTransactionAction } from "./actions";

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore" }).format(new Date());
}

// For cash spending and anything that isn't on a statement.
export function AddTransactionButton({
  categories,
  myName,
  partnerName,
}: {
  categories: Category[];
  myName: string;
  partnerName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"debit" | "credit">("debit");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [owner, setOwner] = useState<OwnerChoice>("me");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await addTransactionAction({ date, description, amount, direction, categoryId, owner, notes });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setDescription("");
      setAmount("");
      setNotes("");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a transaction</DialogTitle>
          <DialogDescription>For cash spending or anything that isn&apos;t on a statement.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-date">Date</Label>
              <Input id="add-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-amount">Amount (SGD)</Label>
              <Input
                id="add-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-description">What was it?</Label>
            <Input
              id="add-description"
              placeholder="e.g. Hawker lunch"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-direction">Type</Label>
              <NativeSelect
                id="add-direction"
                value={direction}
                onChange={(e) => setDirection(e.target.value as "debit" | "credit")}
              >
                <option value="debit">Money out</option>
                <option value="credit">Money in</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-owner">Whose</Label>
              <NativeSelect id="add-owner" value={owner} onChange={(e) => setOwner(e.target.value as OwnerChoice)}>
                <option value="me">Mine ({myName})</option>
                {partnerName && <option value="partner">{partnerName}&apos;s</option>}
                <option value="joint">Joint</option>
              </NativeSelect>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-category">Category</Label>
            <CategorySelect id="add-category" categories={categories} value={categoryId} onChange={setCategoryId} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-notes">Note</Label>
            <Input id="add-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
