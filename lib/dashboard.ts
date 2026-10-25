// Turns raw totals from the database into what the dashboard shows. Kept
// free of database code so it can be tested on its own.

import type { SpendingRow } from "@/lib/db/spending";
import { roundMoney, sumMoney } from "@/lib/money";
import { addMonths, lastMonths } from "@/lib/months";
import type { Budget, Category } from "@/lib/types";

export const FOOD_GROUP = "Food";
const UNCATEGORIZED_COLOR = "#a8a29e";
const OTHER_COLOR = "#78716c";

// Whose spending to show. ownerId null means joint.
export type OwnerFilter = { all: true } | { all: false; ownerId: string | null };

export type MerchantRow = { merchant: string; owner_id: string | null; total: number; transaction_count: number };

export type Slice = { key: string; name: string; color: string; total: number };

export type DashboardData = {
  month: string;
  totalSpent: number;
  previousTotal: number;
  change: number | null; // fraction, e.g. 0.12 for +12%; null without last month's data
  totalBudget: number;
  budgetedSpent: number; // spending in categories that have a budget
  food: {
    total: number;
    previousTotal: number;
    parts: Slice[];
    trend: { month: string; values: Record<string, number> }[];
  };
  byCategory: Slice[]; // biggest first, folded to at most 6 slices
  categoryList: Slice[]; // every category with spending, biggest first
  history: { months: string[]; series: Slice[]; values: Record<string, number>[] };
  budgets: { category: Category; budget: number; spent: number }[];
  topMerchants: { merchant: string; total: number; count: number }[];
};

export function matchesOwner(ownerId: string | null, filter: OwnerFilter) {
  return filter.all || ownerId === filter.ownerId;
}

function totalsFor(rows: SpendingRow[], month: string) {
  const totals = new Map<string | null, number>();
  for (const r of rows) {
    if (r.month !== month) continue;
    totals.set(r.category_id, (totals.get(r.category_id) ?? 0) + r.total);
  }
  return totals;
}

function slice(categoryId: string | null, total: number, byId: Map<string, Category>): Slice {
  const category = categoryId ? byId.get(categoryId) : undefined;
  return {
    key: categoryId ?? "uncategorized",
    name: category?.name ?? "Not categorized",
    color: category?.color ?? UNCATEGORIZED_COLOR,
    total: roundMoney(total),
  };
}

// Keeps the biggest `keep` slices and adds the rest up as "Other".
export function foldSlices(slices: Slice[], keep: number): Slice[] {
  const sorted = [...slices].filter((s) => s.total > 0).sort((a, b) => b.total - a.total);
  if (sorted.length <= keep + 1) return sorted;
  const rest = sorted.slice(keep);
  return [
    ...sorted.slice(0, keep),
    { key: "other", name: `Everything else (${rest.length})`, color: OTHER_COLOR, total: sumMoney(rest.map((s) => s.total)) },
  ];
}

export function buildDashboard(input: {
  month: string;
  historyMonths: number;
  categories: Category[];
  spending: SpendingRow[]; // covers at least historyMonths up to month
  budgets: Budget[]; // for month
  merchants: MerchantRow[]; // for month
  owner: OwnerFilter;
}): DashboardData {
  const { month, categories, owner } = input;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rows = input.spending.filter((r) => matchesOwner(r.owner_id, owner));
  const previous = addMonths(month, -1);

  const current = totalsFor(rows, month);
  const last = totalsFor(rows, previous);
  const totalSpent = sumMoney([...current.values()]);
  const previousTotal = sumMoney([...last.values()]);

  const isFood = (id: string | null) => (id ? byId.get(id)?.group_name?.toLowerCase() === FOOD_GROUP.toLowerCase() : false);
  const foodCategories = categories.filter((c) => isFood(c.id));
  const foodTotal = (totals: Map<string | null, number>) =>
    sumMoney([...totals].filter(([id]) => isFood(id)).map(([, v]) => v));

  const categoryList = [...current]
    .map(([id, total]) => slice(id, total, byId))
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total);

  // History: the same top categories across every month, the rest as Other.
  const months = lastMonths(month, input.historyMonths);
  const periodTotals = new Map<string | null, number>();
  for (const r of rows) {
    if (months.includes(r.month)) periodTotals.set(r.category_id, (periodTotals.get(r.category_id) ?? 0) + r.total);
  }
  const top = foldSlices(
    [...periodTotals].map(([id, total]) => slice(id, total, byId)),
    5,
  );
  const topKeys = new Set(top.filter((s) => s.key !== "other").map((s) => s.key));
  const values = months.map((m) => {
    const totals = totalsFor(rows, m);
    const point: Record<string, number> = {};
    for (const s of top) point[s.key] = 0;
    for (const [id, total] of totals) {
      const key = id ?? "uncategorized";
      const target = topKeys.has(key) ? key : "other";
      if (target in point) point[target] = roundMoney(point[target] + total);
    }
    for (const key of Object.keys(point)) point[key] = Math.max(0, point[key]);
    return point;
  });

  const budgetById = new Map(input.budgets.map((b) => [b.category_id, b.amount]));
  const budgets = categories
    .filter((c) => c.kind === "expense" && budgetById.has(c.id))
    .map((c) => ({ category: c, budget: budgetById.get(c.id)!, spent: roundMoney(current.get(c.id) ?? 0) }));

  const merchantTotals = new Map<string, { total: number; count: number }>();
  for (const m of input.merchants) {
    if (!matchesOwner(m.owner_id, owner)) continue;
    const entry = merchantTotals.get(m.merchant) ?? { total: 0, count: 0 };
    entry.total += Number(m.total);
    entry.count += Number(m.transaction_count);
    merchantTotals.set(m.merchant, entry);
  }
  const topMerchants = [...merchantTotals]
    .map(([merchant, v]) => ({ merchant, total: roundMoney(v.total), count: v.count }))
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return {
    month,
    totalSpent,
    previousTotal,
    change: previousTotal > 0 ? (totalSpent - previousTotal) / previousTotal : null,
    totalBudget: sumMoney(budgets.map((b) => b.budget)),
    budgetedSpent: sumMoney(budgets.map((b) => b.spent)),
    food: {
      total: foodTotal(current),
      previousTotal: foodTotal(last),
      parts: foodCategories.map((c) => slice(c.id, current.get(c.id) ?? 0, byId)),
      trend: lastMonths(month, 6).map((m) => {
        const totals = totalsFor(rows, m);
        return {
          month: m,
          values: Object.fromEntries(foodCategories.map((c) => [c.id, roundMoney(Math.max(0, totals.get(c.id) ?? 0))])),
        };
      }),
    },
    byCategory: foldSlices(categoryList, 5),
    categoryList,
    history: { months, series: top, values },
    budgets,
    topMerchants,
  };
}
