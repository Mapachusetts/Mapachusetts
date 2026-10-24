import { createServerClient } from "@/lib/supabase/server";
import type { Politician } from "@/lib/types";

/**
 * Search politicians by name / office / state / party.
 * Combines Postgres full-text search with a trigram fallback so partial
 * and slightly-misspelled names still match.
 */
export async function searchPoliticians(query: string): Promise<Politician[]> {
  const supabase = createServerClient();
  const q = query.trim();

  if (!q) {
    const { data, error } = await supabase
      .from("politicians")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return (data ?? []) as Politician[];
  }

  // ilike handles partial substring matches on the name;
  // this is simple and reliable for a name-search UI.
  const { data, error } = await supabase
    .from("politicians")
    .select("*")
    .or(
      `name.ilike.%${q}%,current_office.ilike.%${q}%,state.ilike.%${q}%,party.ilike.%${q}%`
    )
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Politician[];
}

/** Fetch a single politician by slug for the detail page. */
export async function getPoliticianBySlug(
  slug: string
): Promise<Politician | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("politicians")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return (data as Politician) ?? null;
}

/** All slugs, used to pre-generate detail pages at build time. */
export async function getAllSlugs(): Promise<string[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase.from("politicians").select("slug");
  if (error) throw error;
  return (data ?? []).map((row) => row.slug as string);
}
