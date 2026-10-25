import "server-only";

import { redirect } from "next/navigation";

import { isEmailAllowed } from "@/lib/allowed-emails";
import { allowedEmailsSetting } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/types";

export class NotSignedInError extends Error {
  constructor() {
    super("Please sign in.");
  }
}

// Checks the login and returns the household member plus a database client
// that acts as them. Every page, server action and API route calls this
// before touching data.
async function loadMember() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims || !isEmailAllowed(claims.email as string | undefined, allowedEmailsSetting())) {
    return null;
  }
  const { data: member } = await supabase
    .from("members")
    .select("id, user_id, email, display_name")
    .eq("user_id", claims.sub)
    .maybeSingle<Member>();
  if (!member) return null;
  return { supabase, member };
}

// For pages: sends the visitor to the login page if needed.
export async function requireMember() {
  const result = await loadMember();
  if (!result) redirect("/login");
  return result;
}

// For server actions and API routes: throws instead of redirecting.
export async function requireMemberForAction() {
  const result = await loadMember();
  if (!result) throw new NotSignedInError();
  return result;
}
