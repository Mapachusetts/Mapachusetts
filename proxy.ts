import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Keeps the Supabase auth session fresh by refreshing the token cookie on
 * every request. Without this, server components can see a stale/expired
 * session. See: supabase.com/docs/guides/auth/server-side/nextjs
 *
 * (Next.js 16 renamed the "middleware" convention to "proxy".)
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If env vars aren't set, skip auth refresh so the rest of the site still loads.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Touch the session so the cookie refreshes if needed.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Run on everything except static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
