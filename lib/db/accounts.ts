import type { SupabaseClient } from "@supabase/supabase-js";

import type { Account } from "@/lib/types";

export async function listAccounts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, bank, owner_id")
    .order("name")
    .returns<Account[]>();
  if (error) throw error;
  return data;
}

// Finds an account by name (ignoring case) or creates it.
export async function findOrCreateAccount(
  supabase: SupabaseClient,
  name: string,
  bank: string | null,
  ownerId: string | null,
): Promise<string> {
  const accounts = await listAccounts(supabase);
  const existing = accounts.find((a) => a.name.toLowerCase() === name.trim().toLowerCase());
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("accounts")
    .insert({ name: name.trim(), bank, owner_id: ownerId })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function createAccount(
  supabase: SupabaseClient,
  account: Pick<Account, "name" | "bank" | "owner_id">,
) {
  const { error } = await supabase.from("accounts").insert(account);
  if (error) throw error;
}

export async function updateAccount(
  supabase: SupabaseClient,
  id: string,
  changes: Partial<Pick<Account, "name" | "bank" | "owner_id">>,
) {
  const { error } = await supabase.from("accounts").update(changes).eq("id", id);
  if (error) throw error;
}

export async function deleteAccount(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw error;
}
