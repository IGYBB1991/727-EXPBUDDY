"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionError, type ActionResult } from "@/lib/action-result";
import { requireMemberForAction } from "@/lib/auth";
import { copyPreviousMonthBudgets, setBudget } from "@/lib/db/budgets";
import { isMonth } from "@/lib/months";

const amountInput = z
  .string()
  .trim()
  .transform((v) => v.replace(/[$,\s]/g, ""))
  .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Enter an amount like 450 or 450.50.")
  .transform((v) => (v === "" ? null : Number(v)));

export async function setBudgetAction(month: string, categoryId: string, amount: string): Promise<ActionResult> {
  if (!isMonth(month)) return { ok: false, error: "Invalid month." };
  const parsed = amountInput.safeParse(amount);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const { supabase } = await requireMemberForAction();
    await setBudget(supabase, month, z.uuid().parse(categoryId), parsed.data);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function copyPreviousMonthAction(month: string): Promise<ActionResult<number>> {
  if (!isMonth(month)) return { ok: false, error: "Invalid month." };
  try {
    const { supabase } = await requireMemberForAction();
    const copied = await copyPreviousMonthBudgets(supabase, month);
    revalidatePath("/", "layout");
    return { ok: true, data: copied };
  } catch (error) {
    return actionError(error);
  }
}
