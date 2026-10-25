"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionError, type ActionResult } from "@/lib/action-result";
import { requireMemberForAction } from "@/lib/auth";
import { listMembers, resolveOwner } from "@/lib/db/members";
import { saveRules } from "@/lib/db/rules";
import {
  addTransaction,
  deleteTransaction,
  findSameMerchant,
  getTransaction,
  setCategoryFor,
  splitTransaction,
  undoSplit,
  updateTransaction,
  validateSplit,
} from "@/lib/db/transactions";
import { patternFor } from "@/lib/merchant-rules";

function refresh() {
  revalidatePath("/", "layout");
}

const id = z.uuid();

// Changes a category, remembers it for the merchant, and reports how many
// other transactions from that merchant are in a different category.
export async function setCategoryAction(
  transactionId: string,
  categoryId: string | null,
): Promise<ActionResult<{ merchant: string; others: number }>> {
  try {
    const { supabase, member } = await requireMemberForAction();
    const tx = await getTransaction(supabase, id.parse(transactionId));
    const category = categoryId === null ? null : id.parse(categoryId);
    await updateTransaction(supabase, tx.id, { category_id: category, needs_review: category === null });
    let others = 0;
    if (category) {
      const pattern = patternFor(tx);
      await saveRules(supabase, [{ pattern, categoryId: category }], member.id);
      others = (await findSameMerchant(supabase, pattern, tx.id, category)).length;
    }
    refresh();
    return { ok: true, data: { merchant: tx.merchant ?? tx.description, others } };
  } catch (error) {
    return actionError(error, "We couldn't change the category. Please try again.");
  }
}

// Gives every transaction from the same merchant this transaction's category.
export async function applyToMerchantAction(transactionId: string): Promise<ActionResult<number>> {
  try {
    const { supabase } = await requireMemberForAction();
    const tx = await getTransaction(supabase, id.parse(transactionId));
    if (!tx.category_id) return { ok: false, error: "Choose a category first." };
    const ids = await findSameMerchant(supabase, patternFor(tx), tx.id, tx.category_id);
    await setCategoryFor(supabase, ids, tx.category_id);
    refresh();
    return { ok: true, data: ids.length };
  } catch (error) {
    return actionError(error, "We couldn't update the other transactions. Please try again.");
  }
}

export async function setNotesAction(transactionId: string, notes: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireMemberForAction();
    const trimmed = notes.trim().slice(0, 500);
    await updateTransaction(supabase, id.parse(transactionId), { notes: trimmed || null });
    refresh();
    return { ok: true };
  } catch (error) {
    return actionError(error, "We couldn't save the note. Please try again.");
  }
}

export async function markCheckedAction(transactionId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireMemberForAction();
    await updateTransaction(supabase, id.parse(transactionId), { needs_review: false });
    refresh();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteTransactionAction(transactionId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireMemberForAction();
    await deleteTransaction(supabase, id.parse(transactionId));
    refresh();
    return { ok: true };
  } catch (error) {
    return actionError(error, "We couldn't delete it. Please try again.");
  }
}

const manualInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  description: z.string().trim().min(1, "Describe what it was for.").max(200),
  amount: z.coerce.number().positive("Enter an amount above zero.").max(10_000_000),
  direction: z.enum(["debit", "credit"]),
  categoryId: z.uuid().nullable(),
  owner: z.enum(["me", "partner", "joint"]),
  notes: z.string().trim().max(500),
});

// For cash spending and anything not on a statement.
export async function addTransactionAction(input: z.input<typeof manualInput>): Promise<ActionResult> {
  const parsed = manualInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const { supabase, member } = await requireMemberForAction();
    const members = await listMembers(supabase);
    const d = parsed.data;
    await addTransaction(supabase, {
      date: d.date,
      description: d.description,
      amount: Math.round(d.amount * 100) / 100,
      direction: d.direction,
      category_id: d.categoryId,
      owner_id: resolveOwner(d.owner, member, members),
      account_id: null,
      notes: d.notes || null,
      created_by: member.id,
    });
    refresh();
    return { ok: true };
  } catch (error) {
    return actionError(error, "We couldn't add it. Please try again.");
  }
}

const splitInput = z.array(
  z.object({ categoryId: z.uuid().nullable(), amount: z.coerce.number(), notes: z.string().max(500).nullable().optional() }),
);

export async function splitAction(transactionId: string, parts: z.input<typeof splitInput>): Promise<ActionResult> {
  const parsed = splitInput.safeParse(parts);
  if (!parsed.success) return { ok: false, error: "Check the amounts and try again." };
  try {
    const { supabase, member } = await requireMemberForAction();
    const tx = await getTransaction(supabase, id.parse(transactionId));
    if (tx.is_split || tx.split_parent_id) return { ok: false, error: "This transaction is already split." };
    const problem = validateSplit(tx.amount, parsed.data);
    if (problem) return { ok: false, error: problem };
    await splitTransaction(supabase, tx, parsed.data, member.id);
    refresh();
    return { ok: true };
  } catch (error) {
    return actionError(error, "We couldn't split it. Please try again.");
  }
}

// Undoes the split a piece belongs to.
export async function undoSplitAction(pieceId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireMemberForAction();
    const piece = await getTransaction(supabase, id.parse(pieceId));
    if (!piece.split_parent_id) return { ok: false, error: "This transaction isn't split." };
    await undoSplit(supabase, piece.split_parent_id);
    refresh();
    return { ok: true };
  } catch (error) {
    return actionError(error, "We couldn't undo the split. Please try again.");
  }
}
