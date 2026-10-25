"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/action-result";
import { formatDay } from "@/lib/months";
import type { Account, Category, Member, MerchantRule, Upload } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  addAccountAction,
  deleteAccountAction,
  deleteRuleAction,
  deleteUploadAction,
  setDisplayNameAction,
  updateAccountAction,
} from "./actions";

// Runs a server action and keeps any error message to show.
function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<ActionResult>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) onDone?.();
      else setError(result.error);
    });
  }
  return { error, pending, run };
}

function ErrorAlert({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <Alert variant="destructive" className="mb-3">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  );
}

function memberName(members: Member[], id: string | null) {
  if (!id) return "Joint";
  return members.find((m) => m.id === id)?.display_name ?? "Unknown";
}

export function NamesPanel({ members, meId }: { members: Member[]; meId: string }) {
  const { error, pending, run } = useAction();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Names</CardTitle>
        <CardDescription>How each of you is shown in filters and on the dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <ErrorAlert error={error} />
        <div className="grid gap-4 sm:grid-cols-2">
          {members.map((m) => (
            <div key={`${m.id}-${m.display_name}`} className="flex flex-col gap-1.5">
              <Label htmlFor={`name-${m.id}`}>
                {m.id === meId ? "You" : "Partner"} <span className="font-normal text-muted-foreground">({m.email})</span>
              </Label>
              <Input
                id={`name-${m.id}`}
                defaultValue={m.display_name}
                maxLength={60}
                disabled={pending}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== m.display_name) run(() => setDisplayNameAction(m.id, value));
                }}
              />
            </div>
          ))}
        </div>
        {members.length < 2 && (
          <p className="mt-3 text-sm text-muted-foreground">
            Your partner appears here after they sign in for the first time.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function OwnerSelect({
  members,
  value,
  onChange,
  disabled,
  id,
}: {
  members: Member[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <NativeSelect id={id} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value || null)}>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.display_name}
        </option>
      ))}
      <option value="">Joint</option>
    </NativeSelect>
  );
}

export function AccountsPanel({ accounts, members }: { accounts: Account[]; members: Member[] }) {
  const { error, pending, run } = useAction();
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [owner, setOwner] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounts and cards</CardTitle>
        <CardDescription>
          New accounts are added automatically when you upload a statement. Deleting one keeps its transactions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ErrorAlert error={error} />
        <ul className={cn("divide-y rounded-md border", pending && "opacity-70")}>
          {accounts.length === 0 && <li className="p-3 text-sm text-muted-foreground">No accounts yet.</li>}
          {accounts.map((a) => (
            <li
              key={`${a.id}-${a.name}-${a.bank}-${a.owner_id}`}
              className="grid grid-cols-[1fr_auto] items-center gap-2 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
            >
              <Input
                aria-label="Account name"
                defaultValue={a.name}
                maxLength={60}
                disabled={pending}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value && value !== a.name) run(() => updateAccountAction(a.id, { name: value }));
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="sm:order-last"
                aria-label={`Delete ${a.name}`}
                disabled={pending}
                onClick={() =>
                  confirm(`Delete "${a.name}"? Its transactions stay, but won't show an account any more.`) &&
                  run(() => deleteAccountAction(a.id))
                }
              >
                <Trash2 />
              </Button>
              <Input
                aria-label="Bank"
                placeholder="Bank"
                defaultValue={a.bank ?? ""}
                maxLength={40}
                disabled={pending}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (value !== (a.bank ?? "")) run(() => updateAccountAction(a.id, { bank: value }));
                }}
              />
              <OwnerSelect
                members={members}
                value={a.owner_id}
                disabled={pending}
                onChange={(value) => run(() => updateAccountAction(a.id, { owner_id: value }))}
              />
            </li>
          ))}
        </ul>

        <form
          className="mt-4 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => addAccountAction({ name, bank, owner_id: owner }),
              () => {
                setName("");
                setBank("");
              },
            );
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-account">New account or card</Label>
            <Input id="new-account" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. UOB One card" maxLength={60} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-bank">Bank</Label>
            <Input id="new-bank" value={bank} onChange={(e) => setBank(e.target.value)} placeholder="UOB" maxLength={40} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-owner">Whose</Label>
            <OwnerSelect id="new-owner" members={members} value={owner} onChange={setOwner} />
          </div>
          <Button type="submit" disabled={pending || !name.trim()}>
            <Plus />
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function RulesPanel({ rules, categories }: { rules: MerchantRule[]; categories: Category[] }) {
  const { error, pending, run } = useAction();
  const byId = new Map(categories.map((c) => [c.id, c]));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Merchant rules</CardTitle>
        <CardDescription>
          When you change a transaction&apos;s category, the app remembers it for that merchant here. Delete a rule to let
          the AI decide again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ErrorAlert error={error} />
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules yet. They appear as you correct categories.</p>
        ) : (
          <ul className={cn("max-h-96 divide-y overflow-y-auto rounded-md border", pending && "opacity-70")}>
            {rules.map((r) => {
              const category = byId.get(r.category_id);
              return (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{r.merchant_pattern}</span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: category?.color }} aria-hidden />
                    {category?.name ?? "Unknown"}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete rule for ${r.merchant_pattern}`}
                    disabled={pending}
                    onClick={() => run(() => deleteRuleAction(r.id))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function UploadsPanel({ uploads, members }: { uploads: Upload[]; members: Member[] }) {
  const { error, pending, run } = useAction();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload history</CardTitle>
        <CardDescription>
          Statement files are never kept, only the transactions read from them. Deleting an upload removes those
          transactions too.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ErrorAlert error={error} />
        {uploads.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing uploaded yet.</p>
        ) : (
          <ul className={cn("divide-y rounded-md border", pending && "opacity-70")}>
            {uploads.map((u) => (
              <li key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{u.file_name}</p>
                  <p className="text-muted-foreground">
                    {formatDay(u.uploaded_at.slice(0, 10))}{u.uploaded_by && ` by ${memberName(members, u.uploaded_by)}`} ·{" "}
                    {u.transaction_count} transaction{u.transaction_count === 1 ? "" : "s"}
                    {u.period_start && u.period_end && ` · ${formatDay(u.period_start)} to ${formatDay(u.period_end)}`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete upload ${u.file_name}`}
                  disabled={pending}
                  onClick={() =>
                    confirm(
                      `Delete "${u.file_name}" and its ${u.transaction_count} transaction${u.transaction_count === 1 ? "" : "s"}? This can't be undone.`,
                    ) && run(() => deleteUploadAction(u.id))
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
