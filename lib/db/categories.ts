import type { SupabaseClient } from "@supabase/supabase-js";

import type { Category } from "@/lib/types";

export async function listCategories(supabase: SupabaseClient, opts: { activeOnly?: boolean } = {}) {
  let query = supabase
    .from("categories")
    .select("id, name, group_name, color, kind, is_active, sort_order")
    .order("sort_order")
    .order("name");
  if (opts.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query.returns<Category[]>();
  if (error) throw error;
  return data;
}

export async function createCategory(
  supabase: SupabaseClient,
  input: Pick<Category, "name" | "group_name" | "color" | "kind">,
) {
  const { data: last } = await supabase
    .from("categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ sort_order: number }>();
  const { error } = await supabase
    .from("categories")
    .insert({ ...input, sort_order: (last?.sort_order ?? 0) + 10 });
  if (error) throw error;
}

export async function updateCategory(
  supabase: SupabaseClient,
  id: string,
  changes: Partial<Pick<Category, "name" | "group_name" | "color" | "kind" | "is_active">>,
) {
  const { error } = await supabase.from("categories").update(changes).eq("id", id);
  if (error) throw error;
}

// Moves a category one place up or down and renumbers the list.
export async function moveCategory(supabase: SupabaseClient, id: string, direction: "up" | "down") {
  const categories = await listCategories(supabase);
  const index = categories.findIndex((c) => c.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= categories.length) return;
  [categories[index], categories[target]] = [categories[target], categories[index]];
  const updates = categories
    .map((c, i) => ({ id: c.id, sort_order: (i + 1) * 10, old: c.sort_order }))
    .filter((c) => c.sort_order !== c.old);
  for (const u of updates) {
    const { error } = await supabase.from("categories").update({ sort_order: u.sort_order }).eq("id", u.id);
    if (error) throw error;
  }
}
