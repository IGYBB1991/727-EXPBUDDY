import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { supabasePublishableKey, supabaseSecretKey, supabaseUrl } from "@/lib/env";

// A database client that acts as the logged-in person. The database's
// security rules apply, so it can only see household data if that person is
// a member. Create a new one for every request.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a page, where cookies can't be written. The proxy
          // refreshes the session instead, so this is safe to ignore.
        }
      },
    },
  });
}

// A database client with full access that skips the security rules.
// Only used to add a new member on their first login. Never send it, or
// anything it returns unchecked, to the browser.
export function createAdminClient() {
  return createSupabaseClient(supabaseUrl(), supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
