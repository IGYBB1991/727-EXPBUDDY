import type { SupabaseClient } from "@supabase/supabase-js";

import { addMonths } from "@/lib/months";
import type { Budget } from "@/lib/types";

export async function listBudgets(supabase: SupabaseClient, months: string[]) {
  const { data, error } = await supabase
    .from("budgets")
    .select("id, month, category_id, amount")
    .in("month", months)
    .returns<Budget[]>();
  if (error) throw error;
  return data.map((b) => ({ ...b, amount: Number(b.amount) }));
}

// Sets one category's budget for a month. An empty amount removes it.
export async function setBudget(
  supabase: SupabaseClient,
  month: string,
  categoryId: string,
  amount: number | null,
) {
  if (amount === null) {
    const { error } = await supabase
      .from("budgets")
      .delete()
      .eq("month", month)
      .eq("category_id", categoryId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("budgets")
    .upsert({ month, category_id: categoryId, amount }, { onConflict: "month,category_id" });
  if (error) throw error;
}

// Copies last month's budgets into this month, replacing any already set.
// Returns how many were copied.
export async function copyPreviousMonthBudgets(supabase: SupabaseClient, month: string) {
  const previous = await listBudgets(supabase, [addMonths(month, -1)]);
  if (previous.length === 0) return 0;
  const { error } = await supabase.from("budgets").upsert(
    previous.map((b) => ({ month, category_id: b.category_id, amount: b.amount })),
    { onConflict: "month,category_id" },
  );
  if (error) throw error;
  return previous.length;
}
