import { createServerClient } from "@/lib/supabase/server";
import type { Article } from "@/lib/types";

/** Fetch the most recent articles, newest first. */
export async function getArticles(limit = 50): Promise<Article[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Article[];
}
