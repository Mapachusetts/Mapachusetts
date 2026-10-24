"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 *
 * Uses the public anon key and respects Row Level Security, so it is safe to
 * use in client components. Auth sessions are persisted in cookies so the
 * server can read them too (see lib/supabase/serverAuth.ts).
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createBrowserClient(url, anonKey);
}
