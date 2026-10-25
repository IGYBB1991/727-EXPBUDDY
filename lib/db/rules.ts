import type { SupabaseClient } from "@supabase/supabase-js";

import type { MerchantRule } from "@/lib/types";

export async function listRules(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("merchant_rules")
    .select("id, merchant_pattern, category_id, created_by, created_at")
    .order("merchant_pattern")
    .returns<MerchantRule[]>();
  if (error) throw error;
  return data;
}

// Saves (or updates) "this merchant always goes in this category".
export async function saveRules(
  supabase: SupabaseClient,
  rules: { pattern: string; categoryId: string }[],
  createdBy: string,
) {
  const unique = new Map(rules.filter((r) => r.pattern).map((r) => [r.pattern, r.categoryId]));
  if (unique.size === 0) return;
  const { error } = await supabase.from("merchant_rules").upsert(
    [...unique].map(([merchant_pattern, category_id]) => ({ merchant_pattern, category_id, created_by: createdBy })),
    { onConflict: "merchant_pattern" },
  );
  if (error) throw error;
}

export async function deleteRule(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("merchant_rules").delete().eq("id", id);
  if (error) throw error;
}
