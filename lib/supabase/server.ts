import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase client.
 *
 * Uses the service_role key, which bypasses Row Level Security.
 * NEVER import this into a client component or expose it to the browser.
 * It is only safe inside server components, route handlers, and server actions.
 */
export function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
