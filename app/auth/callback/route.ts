import { NextResponse, type NextRequest } from "next/server";

import { isEmailAllowed } from "@/lib/allowed-emails";
import { allowedEmailsSetting } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";

// Google sends the visitor back here after they sign in.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=callback`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=callback`);

  const user = data.user;
  if (!isEmailAllowed(user.email, allowedEmailsSetting())) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_allowed`);
  }

  // First sign-in: add them to the household.
  const displayName =
    (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
    user.email!.split("@")[0];
  const { error: memberError } = await createAdminClient()
    .from("members")
    .upsert(
      { user_id: user.id, email: user.email!.toLowerCase(), display_name: displayName },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  if (memberError) {
    console.error("Could not add member", memberError);
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  return NextResponse.redirect(`${origin}/`);
}
