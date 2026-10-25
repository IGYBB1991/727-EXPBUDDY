import type { SupabaseClient } from "@supabase/supabase-js";

import { monthRange } from "@/lib/months";

export type SpendingRow = {
  month: string;
  category_id: string | null;
  owner_id: string | null;
  total: number;
};

// Spending per month, category and owner between two months (inclusive).
export async function monthlySpending(
  supabase: SupabaseClient,
  fromMonth: string,
  toMonth: string,
): Promise<SpendingRow[]> {
  const { data, error } = await supabase.rpc("monthly_spending", {
    p_from: monthRange(fromMonth).from,
    p_to: monthRange(toMonth).to,
  });
  if (error) throw error;
  return (data as SpendingRow[]).map((r) => ({ ...r, total: Number(r.total) }));
}

// Adds rows up per category.
export function totalsByCategory(rows: SpendingRow[]): Map<string | null, number> {
  const totals = new Map<string | null, number>();
  for (const r of rows) totals.set(r.category_id, (totals.get(r.category_id) ?? 0) + r.total);
  return totals;
}
