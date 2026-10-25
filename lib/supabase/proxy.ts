import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isEmailAllowed } from "@/lib/allowed-emails";
import { allowedEmailsSetting, supabasePublishableKey, supabaseUrl } from "@/lib/env";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

// Runs before every page and API request: keeps the login fresh and sends
// anyone who isn't logged in (or isn't on the allowed list) to /login.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Don't put code between createServerClient and getClaims: it refreshes
  // the session cookie when needed.
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email as string | undefined;
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

  if (isPublic) return response;

  const signedIn = Boolean(data?.claims);
  const allowed = signedIn && isEmailAllowed(email, allowedEmailsSetting());

  if (!allowed) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = signedIn ? "?error=not_allowed" : "";
    const redirect = NextResponse.redirect(url);
    if (signedIn) {
      // Not on the list: end their session.
      await supabase.auth.signOut();
    }
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}
