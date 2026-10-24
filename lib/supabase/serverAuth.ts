import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server-side, auth-aware Supabase client.
 *
 * Uses the anon key and the request's session cookie, so Row Level Security
 * applies with the logged-in user's identity (auth.uid()). Use this — not the
 * service-role client — anywhere you act on behalf of the signed-in user.
 *
 * Must be called inside a server component, route handler, or server action
 * (anything that can access the cookie store).
 */
export async function createAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if there is middleware refreshing sessions.
        }
      },
    },
  });
}

/** Returns the current signed-in user, or null if logged out. Server-only. */
export async function getUser() {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
