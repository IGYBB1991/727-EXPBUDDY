"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionError, type ActionResult } from "@/lib/action-result";
import { requireMemberForAction } from "@/lib/auth";
import { findOrCreateAccount } from "@/lib/db/accounts";
import { listMembers, resolveOwner } from "@/lib/db/members";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const transactionInput = z.object({
  date: isoDate,
  description: z.string().trim().min(1).max(500),
  merchant: z.string().trim().max(200).nullable(),
  amount: z.number().nonnegative().max(10_000_000),
  direction: z.enum(["debit", "credit"]),
  categoryId: z.uuid().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  needsReview: z.boolean(),
});

const saveInput = z.object({
  owner: z.enum(["me", "partner", "joint"]),
  files: z
    .array(
      z.object({
        fileName: z.string().trim().min(1).max(255),
        bank: z.string().trim().max(100).nullable(),
        accountName: z.string().trim().max(100),
        transactions: z.array(transactionInput).max(5000),
      }),
    )
    .min(1)
    .max(20),
});

export type SaveUploadInput = z.input<typeof saveInput>;

// Saves the transactions the person confirmed on the review screen.
export async function saveUploadAction(input: SaveUploadInput): Promise<ActionResult<{ saved: number }>> {
  const parsed = saveInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Some of the transactions aren't valid. Please check them and try again." };

  try {
    const { supabase, member } = await requireMemberForAction();
    const members = await listMembers(supabase);
    const ownerId = resolveOwner(parsed.data.owner, member, members);
    let saved = 0;

    for (const file of parsed.data.files) {
      if (file.transactions.length === 0) continue;
      const accountId = file.accountName
        ? await findOrCreateAccount(supabase, file.accountName, file.bank, ownerId)
        : null;
      const dates = file.transactions.map((t) => t.date).sort();

      const { data: upload, error: uploadError } = await supabase
        .from("uploads")
        .insert({
          file_name: file.fileName,
          bank: file.bank,
          uploaded_by: member.id,
          transaction_count: file.transactions.length,
          period_start: dates[0],
          period_end: dates.at(-1),
        })
        .select("id")
        .single<{ id: string }>();
      if (uploadError) throw uploadError;

      const rows = file.transactions.map((t) => ({
        date: t.date,
        description: t.description,
        merchant: t.merchant,
        amount: t.amount,
        direction: t.direction,
        category_id: t.categoryId,
        owner_id: ownerId,
        account_id: accountId,
        source_file: file.fileName,
        ai_confidence: t.confidence,
        needs_review: t.needsReview || t.categoryId === null,
        upload_id: upload.id,
        created_by: member.id,
      }));
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await supabase.from("transactions").insert(rows.slice(i, i + 500));
        if (error) {
          // Don't leave half an upload behind: removing the upload removes its rows.
          await supabase.from("uploads").delete().eq("id", upload.id);
          throw error;
        }
      }
      saved += rows.length;
    }

    revalidatePath("/", "layout");
    return { ok: true, data: { saved } };
  } catch (error) {
    return actionError(error, "We couldn't save these transactions. Please try again.");
  }
}
