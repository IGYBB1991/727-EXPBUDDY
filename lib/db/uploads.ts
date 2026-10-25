import type { SupabaseClient } from "@supabase/supabase-js";

import type { Upload } from "@/lib/types";

export async function listUploads(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("uploads")
    .select("id, file_name, bank, uploaded_by, uploaded_at, transaction_count, period_start, period_end")
    .order("uploaded_at", { ascending: false })
    .limit(200)
    .returns<Upload[]>();
  if (error) throw error;
  return data;
}

// Deleting an upload also deletes every transaction that came from it
// (the database does this automatically).
export async function deleteUpload(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from("uploads").delete().eq("id", id);
  if (error) throw error;
}
