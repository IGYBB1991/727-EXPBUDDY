"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { MonthPicker } from "@/components/month-picker";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { currentMonth } from "@/lib/months";
import type { Account, Category } from "@/lib/types";

// The filter row above the transaction list. Every filter lives in the
// address bar, so a filtered list can be bookmarked or shared.
export function TransactionFilters({
  month,
  categories,
  accounts,
  partnerName,
}: {
  month: string | "all";
  categories: Category[];
  accounts: Account[];
  partnerName: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  function set(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {month === "all" ? (
          <button
            className="h-10 rounded-lg border bg-card px-3 text-sm font-medium"
            onClick={() => set("month", currentMonth())}
          >
            All months · show one month
          </button>
        ) : (
          <MonthPicker month={month} />
        )}
        {month !== "all" && (
          <button className="text-sm text-primary underline-offset-4 hover:underline" onClick={() => set("month", "all")}>
            All months
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-[1fr_repeat(3,10rem)_auto]">
        <form
          className="relative col-span-2 md:col-span-1"
          onSubmit={(e) => {
            e.preventDefault();
            set("q", search.trim() || null);
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search description, merchant or notes"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => search.trim() !== (searchParams.get("q") ?? "") && set("q", search.trim() || null)}
            className="pl-9"
            aria-label="Search"
          />
        </form>
        <NativeSelect
          aria-label="Category"
          value={searchParams.get("category") ?? ""}
          onChange={(e) => set("category", e.target.value || null)}
        >
          <option value="">All categories</option>
          <option value="none">Not categorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Whose"
          value={searchParams.get("owner") ?? ""}
          onChange={(e) => set("owner", e.target.value || null)}
        >
          <option value="">Everyone</option>
          <option value="mine">Mine</option>
          <option value="partner">{partnerName ? `${partnerName}'s` : "Partner's"}</option>
          <option value="joint">Joint</option>
        </NativeSelect>
        <NativeSelect
          aria-label="Account"
          value={searchParams.get("account") ?? ""}
          onChange={(e) => set("account", e.target.value || null)}
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
        <label className="flex h-10 items-center gap-2 rounded-md border bg-card px-3 text-sm whitespace-nowrap">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={searchParams.get("review") === "1"}
            onChange={(e) => set("review", e.target.checked ? "1" : null)}
          />
          Needs review
        </label>
      </div>
    </div>
  );
}
