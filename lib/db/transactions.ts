import type { SupabaseClient } from "@supabase/supabase-js";

import { findRule } from "@/lib/merchant-rules";
import { monthRange } from "@/lib/months";
import { roundMoney, sumMoney } from "@/lib/money";
import type { OwnerFilter } from "@/lib/dashboard";
import type { Direction, Transaction } from "@/lib/types";
import { fetchAllPages } from "./paging";

const COLUMNS =
  "id, date, description, merchant, amount, direction, category_id, owner_id, account_id, source_file, ai_confidence, needs_review, notes, upload_id, split_parent_id, is_split, created_by, created_at";

export type TransactionFilters = {
  month: string | "all";
  categoryId?: string | "none";
  owner: OwnerFilter;
  accountId?: string;
  needsReview?: boolean;
  search?: string;
};

export const MAX_LISTED = 2000;

function toTransaction(row: Transaction): Transaction {
  return { ...row, amount: Number(row.amount), ai_confidence: row.ai_confidence === null ? null : Number(row.ai_confidence) };
}

// Transactions matching the filters, newest first. Split originals are left
// out because their pieces are listed instead.
export async function listTransactions(supabase: SupabaseClient, filters: TransactionFilters) {
  const rows = await fetchAllPages<Transaction>((from, to) => {
    let query = supabase.from("transactions").select(COLUMNS).eq("is_split", false);
    if (filters.month !== "all") {
      const range = monthRange(filters.month);
      query = query.gte("date", range.from).lte("date", range.to);
    }
    if (filters.categoryId === "none") query = query.is("category_id", null);
    else if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
    if (!filters.owner.all) {
      query = filters.owner.ownerId ? query.eq("owner_id", filters.owner.ownerId) : query.is("owner_id", null);
    }
    if (filters.accountId) query = query.eq("account_id", filters.accountId);
    if (filters.needsReview) query = query.eq("needs_review", true);
    if (filters.search) {
      // Commas and brackets have meaning in Supabase filters, so drop them.
      const term = filters.search.replace(/[,()*%\\]/g, " ").trim();
      if (term) query = query.or(`description.ilike.%${term}%,merchant.ilike.%${term}%,notes.ilike.%${term}%`);
    }
    return query
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to);
  }, MAX_LISTED);
  return rows.map(toTransaction);
}

export async function getTransaction(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("transactions").select(COLUMNS).eq("id", id).single<Transaction>();
  if (error) throw error;
  return toTransaction(data);
}

export async function updateTransaction(
  supabase: SupabaseClient,
  id: string,
  changes: Partial<Pick<Transaction, "category_id" | "notes" | "needs_review" | "owner_id" | "merchant">>,
) {
  const { error } = await supabase.from("transactions").update(changes).eq("id", id);
  if (error) throw error;
}

export async function deleteTransaction(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

export async function addTransaction(
  supabase: SupabaseClient,
  input: {
    date: string;
    description: string;
    amount: number;
    direction: Direction;
    category_id: string | null;
    owner_id: string | null;
    account_id: string | null;
    notes: string | null;
    created_by: string;
  },
) {
  const { error } = await supabase
    .from("transactions")
    .insert({ ...input, merchant: input.description, needs_review: false });
  if (error) throw error;
}

// Other transactions from the same merchant (by the saved rule pattern) that
// are in a different category.
export async function findSameMerchant(
  supabase: SupabaseClient,
  pattern: string,
  exceptId: string,
  categoryId: string,
) {
  const rows = await fetchAllPages<Pick<Transaction, "id" | "description" | "merchant" | "category_id">>((from, to) =>
    supabase
      .from("transactions")
      .select("id, description, merchant, category_id")
      .eq("is_split", false)
      .is("split_parent_id", null)
      .order("id")
      .range(from, to),
  );
  const rule = [{ merchant_pattern: pattern, category_id: categoryId }];
  return rows.filter((r) => r.id !== exceptId && r.category_id !== categoryId && findRule(r, rule)).map((r) => r.id);
}

export async function setCategoryFor(supabase: SupabaseClient, ids: string[], categoryId: string) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase
      .from("transactions")
      .update({ category_id: categoryId, needs_review: false })
      .in("id", ids.slice(i, i + 200));
    if (error) throw error;
  }
}

export type SplitPart = { categoryId: string | null; amount: number; notes?: string | null };

// Checks a split adds up to the original amount, to the cent.
export function validateSplit(total: number, parts: SplitPart[]): string | null {
  if (parts.length < 2) return "Split into at least two parts.";
  if (parts.some((p) => !(p.amount > 0))) return "Every part needs an amount above zero.";
  const sum = sumMoney(parts.map((p) => p.amount));
  if (Math.round(sum * 100) !== Math.round(total * 100)) {
    const diff = roundMoney(total - sum);
    return diff > 0 ? `The parts are $${diff.toFixed(2)} short of the total.` : `The parts are $${(-diff).toFixed(2)} over the total.`;
  }
  return null;
}

// Splits one transaction into several categories. The original is kept (and
// left out of totals) so the split can be undone.
export async function splitTransaction(supabase: SupabaseClient, original: Transaction, parts: SplitPart[], memberId: string) {
  const rows = parts.map((p) => ({
    date: original.date,
    description: original.description,
    merchant: original.merchant,
    amount: roundMoney(p.amount),
    direction: original.direction,
    category_id: p.categoryId,
    owner_id: original.owner_id,
    account_id: original.account_id,
    source_file: original.source_file,
    needs_review: false,
    notes: p.notes ?? original.notes,
    upload_id: original.upload_id,
    split_parent_id: original.id,
    created_by: memberId,
  }));
  const { error } = await supabase.from("transactions").insert(rows);
  if (error) throw error;
  const { error: parentError } = await supabase.from("transactions").update({ is_split: true }).eq("id", original.id);
  if (parentError) {
    await supabase.from("transactions").delete().eq("split_parent_id", original.id);
    throw parentError;
  }
}

// Puts a split transaction back together.
export async function undoSplit(supabase: SupabaseClient, parentId: string) {
  const { error } = await supabase.from("transactions").update({ is_split: false }).eq("id", parentId);
  if (error) throw error;
  const { error: deleteError } = await supabase.from("transactions").delete().eq("split_parent_id", parentId);
  if (deleteError) throw deleteError;
}
