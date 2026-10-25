"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { ActionResult } from "@/lib/action-result";
import type { Category, CategoryKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { addCategoryAction, moveCategoryAction, updateCategoryAction } from "./actions";

const KIND_LABELS: Record<CategoryKind, string> = {
  expense: "Spending",
  transfer: "Transfer",
  income: "Income",
};

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <AddCategory onAdd={(input) => run(() => addCategoryAction(input))} disabled={pending} />

      <Card className="py-2">
        <ul className={cn("divide-y", pending && "opacity-70")}>
          {categories.map((category, index) => (
            <CategoryRow
              key={`${category.id}-${category.name}-${category.color}-${category.group_name}`}
              category={category}
              isFirst={index === 0}
              isLast={index === categories.length - 1}
              disabled={pending}
              onChange={(changes) => run(() => updateCategoryAction(category.id, changes))}
              onMove={(direction) => run(() => moveCategoryAction(category.id, direction))}
            />
          ))}
        </ul>
      </Card>
    </div>
  );
}

type Changes = Parameters<typeof updateCategoryAction>[1];

function CategoryRow({
  category,
  isFirst,
  isLast,
  disabled,
  onChange,
  onMove,
}: {
  category: Category;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onChange: (changes: Changes) => void;
  onMove: (direction: "up" | "down") => void;
}) {
  const [name, setName] = useState(category.name);
  const [group, setGroup] = useState(category.group_name ?? "");

  return (
    <li className={cn("flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center", !category.is_active && "opacity-60")}>
      <div className="flex flex-1 items-center gap-3">
        <input
          type="color"
          aria-label={`Color for ${category.name}`}
          defaultValue={category.color}
          disabled={disabled}
          onBlur={(e) => e.target.value !== category.color && onChange({ color: e.target.value })}
          className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
        />
        <Input
          aria-label="Name"
          value={name}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() !== category.name && onChange({ name })}
          className="flex-1"
        />
      </div>
      <div className="flex items-center gap-2">
        <Input
          aria-label="Group"
          placeholder="Group (optional)"
          value={group}
          disabled={disabled}
          onChange={(e) => setGroup(e.target.value)}
          onBlur={() => group.trim() !== (category.group_name ?? "") && onChange({ group_name: group })}
          className="w-full sm:w-36"
        />
        <NativeSelect
          aria-label="Type"
          value={category.kind}
          disabled={disabled}
          onChange={(e) => onChange({ kind: e.target.value as CategoryKind })}
          className="w-full sm:w-32"
        >
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="flex items-center justify-between gap-1 sm:justify-end">
        {!category.is_active && <Badge variant="secondary">Hidden</Badge>}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            title={category.is_active ? "Hide" : "Show"}
            disabled={disabled}
            onClick={() => onChange({ is_active: !category.is_active })}
          >
            {category.is_active ? <EyeOff /> : <Eye />}
            <span className="sr-only">{category.is_active ? "Hide" : "Show"}</span>
          </Button>
          <Button variant="ghost" size="icon-sm" title="Move up" disabled={disabled || isFirst} onClick={() => onMove("up")}>
            <ArrowUp />
            <span className="sr-only">Move up</span>
          </Button>
          <Button variant="ghost" size="icon-sm" title="Move down" disabled={disabled || isLast} onClick={() => onMove("down")}>
            <ArrowDown />
            <span className="sr-only">Move down</span>
          </Button>
        </div>
      </div>
    </li>
  );
}

function AddCategory({
  onAdd,
  disabled,
}: {
  onAdd: (input: { name: string; group_name: string; color: string; kind: CategoryKind }) => void;
  disabled: boolean;
}) {
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [color, setColor] = useState("#64748b");
  const [kind, setKind] = useState<CategoryKind>("expense");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Add a category</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-[auto_1fr_10rem_9rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onAdd({ name, group_name: group, color, kind });
            setName("");
            setGroup("");
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-color">Color</Label>
            <input
              id="new-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-10 w-14 cursor-pointer rounded-md border bg-transparent p-1"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-name">Name</Label>
            <Input id="new-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pets" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-group">Group</Label>
            <Input id="new-group" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Optional" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-kind">Type</Label>
            <NativeSelect id="new-kind" value={kind} onChange={(e) => setKind(e.target.value as CategoryKind)}>
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" disabled={disabled || !name.trim()}>
            <Plus />
            Add
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
