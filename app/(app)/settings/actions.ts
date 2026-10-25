"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionError, type ActionResult } from "@/lib/action-result";
import { requireMemberForAction } from "@/lib/auth";
import { createAccount, deleteAccount, updateAccount } from "@/lib/db/accounts";
import { listMembers, updateDisplayName } from "@/lib/db/members";
import { deleteRule } from "@/lib/db/rules";
import { deleteUpload } from "@/lib/db/uploads";

const id = z.string().uuid();
const name = z.string().trim().min(1, "Please enter a name.").max(60);

const accountInput = z.object({
  name,
  bank: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v || null),
  // Member id, or null for a joint account.
  owner_id: id.nullable(),
});

function refresh() {
  revalidatePath("/", "layout");
}

async function run(work: (supabase: Awaited<ReturnType<typeof requireMemberForAction>>["supabase"]) => Promise<void>) {
  try {
    const { supabase } = await requireMemberForAction();
    await work(supabase);
    refresh();
    return { ok: true } as const;
  } catch (error) {
    return actionError(error);
  }
}

export async function setDisplayNameAction(memberId: string, displayName: string): Promise<ActionResult> {
  const parsed = z.object({ memberId: id, displayName: name }).safeParse({ memberId, displayName });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return run(async (supabase) => {
    const members = await listMembers(supabase);
    if (!members.some((m) => m.id === parsed.data.memberId)) throw new Error("Unknown member");
    await updateDisplayName(supabase, parsed.data.memberId, parsed.data.displayName);
  });
}

export async function addAccountAction(input: z.input<typeof accountInput>): Promise<ActionResult> {
  const parsed = accountInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return run((supabase) => createAccount(supabase, parsed.data));
}

export async function updateAccountAction(accountId: string, input: Partial<z.input<typeof accountInput>>): Promise<ActionResult> {
  const parsed = accountInput.partial().safeParse(input);
  if (!parsed.success || !id.safeParse(accountId).success) {
    return { ok: false, error: parsed.error?.issues[0].message ?? "Something went wrong." };
  }
  return run((supabase) => updateAccount(supabase, accountId, parsed.data));
}

export async function deleteAccountAction(accountId: string): Promise<ActionResult> {
  if (!id.safeParse(accountId).success) return { ok: false, error: "Something went wrong." };
  return run((supabase) => deleteAccount(supabase, accountId));
}

export async function deleteRuleAction(ruleId: string): Promise<ActionResult> {
  if (!id.safeParse(ruleId).success) return { ok: false, error: "Something went wrong." };
  return run((supabase) => deleteRule(supabase, ruleId));
}

export async function deleteUploadAction(uploadId: string): Promise<ActionResult> {
  if (!id.safeParse(uploadId).success) return { ok: false, error: "Something went wrong." };
  return run((supabase) => deleteUpload(supabase, uploadId));
}
