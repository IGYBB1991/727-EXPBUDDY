"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionError, type ActionResult } from "@/lib/action-result";
import { requireMemberForAction } from "@/lib/auth";
import { createCategory, moveCategory, updateCategory } from "@/lib/db/categories";

const categoryInput = z.object({
  name: z.string().trim().min(1, "Please enter a name.").max(60),
  group_name: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v || null),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  kind: z.enum(["expense", "transfer", "income"]),
});

function refresh() {
  revalidatePath("/", "layout");
}

export async function addCategoryAction(input: z.input<typeof categoryInput>): Promise<ActionResult> {
  const parsed = categoryInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const { supabase } = await requireMemberForAction();
    await createCategory(supabase, parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateCategoryAction(
  id: string,
  input: Partial<z.input<typeof categoryInput>> & { is_active?: boolean },
): Promise<ActionResult> {
  const parsed = categoryInput.partial().extend({ is_active: z.boolean().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const { supabase } = await requireMemberForAction();
    await updateCategory(supabase, z.uuid().parse(id), parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function moveCategoryAction(id: string, direction: "up" | "down"): Promise<ActionResult> {
  try {
    const { supabase } = await requireMemberForAction();
    await moveCategory(supabase, z.uuid().parse(id), direction === "up" ? "up" : "down");
    refresh();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
