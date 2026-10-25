import { describe, expect, it } from "vitest";

import { buildDashboard, foldSlices } from "@/lib/dashboard";
import type { Category } from "@/lib/types";

const cat = (id: string, name: string, group: string | null = null): Category => ({
  id,
  name,
  group_name: group,
  color: `#${id.padEnd(6, "0")}`,
  kind: "expense",
  is_active: true,
  sort_order: 0,
});
const categories = [
  cat("a1", "Groceries", "Food"),
  cat("a2", "Dining out", "Food"),
  cat("a3", "Food delivery", "Food"),
  cat("b1", "Transport"),
  cat("b2", "Shopping"),
];
const JASON = "jason";
const WIFE = "wife";
const row = (month: string, category_id: string | null, total: number, owner_id: string | null = JASON) => ({
  month,
  category_id,
  owner_id,
  total,
});

const spending = [
  row("2026-09", "a1", 300),
  row("2026-09", "b1", 100),
  row("2026-10", "a1", 200),
  row("2026-10", "a2", 150, WIFE),
  row("2026-10", "a3", 50, null),
  row("2026-10", "b1", 80),
  row("2026-10", null, 20),
];

const base = {
  month: "2026-10",
  historyMonths: 6,
  categories,
  spending,
  budgets: [{ id: "x", month: "2026-10", category_id: "a1", amount: 250 }],
  merchants: [
    { merchant: "NTUC FairPrice", owner_id: JASON, total: 200, transaction_count: 4 },
    { merchant: "Toast Box", owner_id: WIFE, total: 150, transaction_count: 9 },
  ],
};

describe("buildDashboard", () => {
  it("adds up the month, Food and the change from last month", () => {
    const d = buildDashboard({ ...base, owner: { all: true } });
    expect(d.totalSpent).toBe(500);
    expect(d.previousTotal).toBe(400);
    expect(d.change).toBeCloseTo(0.25);
    expect(d.food.total).toBe(400);
    expect(d.food.previousTotal).toBe(300);
    expect(d.food.parts.map((p) => [p.name, p.total])).toEqual([
      ["Groceries", 200],
      ["Dining out", 150],
      ["Food delivery", 50],
    ]);
    expect(d.food.trend.at(-1)).toEqual({ month: "2026-10", values: { a1: 200, a2: 150, a3: 50 } });
    expect(d.totalBudget).toBe(250);
    expect(d.budgetedSpent).toBe(200);
    expect(d.budgets[0]).toMatchObject({ budget: 250, spent: 200 });
    expect(d.categoryList.map((s) => s.name)).toEqual(["Groceries", "Dining out", "Transport", "Food delivery", "Not categorized"]);
    expect(d.topMerchants[0]).toEqual({ merchant: "NTUC FairPrice", total: 200, count: 4 });
  });

  it("filters by owner, with null meaning joint", () => {
    expect(buildDashboard({ ...base, owner: { all: false, ownerId: WIFE } }).totalSpent).toBe(150);
    expect(buildDashboard({ ...base, owner: { all: false, ownerId: null } }).totalSpent).toBe(50);
    const mine = buildDashboard({ ...base, owner: { all: false, ownerId: JASON } });
    expect(mine.totalSpent).toBe(300);
    expect(mine.topMerchants.map((m) => m.merchant)).toEqual(["NTUC FairPrice"]);
  });

  it("keeps the same categories across the history months", () => {
    const d = buildDashboard({ ...base, owner: { all: true } });
    expect(d.history.months).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(d.history.values.at(-2)).toMatchObject({ a1: 300, b1: 100, a2: 0 });
  });

  it("has no change figure without last month's data", () => {
    const d = buildDashboard({ ...base, spending: spending.filter((r) => r.month === "2026-10"), owner: { all: true } });
    expect(d.change).toBeNull();
  });
});

describe("foldSlices", () => {
  it("folds the smallest slices into Other", () => {
    const slices = [10, 50, 30, 20, 40, 5, 1].map((total, i) => ({ key: `${i}`, name: `${i}`, color: "#000", total }));
    const folded = foldSlices(slices, 3);
    expect(folded.map((s) => s.total)).toEqual([50, 40, 30, 36]);
    expect(folded.at(-1)?.name).toBe("Everything else (4)");
  });

  it("doesn't make an Other slice for a single leftover", () => {
    const slices = [3, 2, 1].map((total, i) => ({ key: `${i}`, name: `${i}`, color: "#000", total }));
    expect(foldSlices(slices, 2)).toHaveLength(3);
  });
});
