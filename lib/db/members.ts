import type { SupabaseClient } from "@supabase/supabase-js";

import type { Member } from "@/lib/types";

export async function listMembers(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("members")
    .select("id, user_id, email, display_name")
    .order("created_at")
    .returns<Member[]>();
  if (error) throw error;
  return data;
}

export async function updateDisplayName(supabase: SupabaseClient, id: string, displayName: string) {
  const { error } = await supabase.from("members").update({ display_name: displayName }).eq("id", id);
  if (error) throw error;
}

// "Whose statement is this?" as the person uploading sees it.
export type OwnerChoice = "me" | "partner" | "joint";

// Turns a choice into the member id saved with each transaction (null means
// joint). "partner" is the other household member.
export function resolveOwner(choice: OwnerChoice, me: Member, members: Member[]): string | null {
  if (choice === "me") return me.id;
  if (choice === "partner") return members.find((m) => m.id !== me.id)?.id ?? null;
  return null;
}
