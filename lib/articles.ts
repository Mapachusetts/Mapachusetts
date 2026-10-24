import { createServerClient } from "@/lib/supabase/server";
import type { Article, PoliticianNewsSummary } from "@/lib/types";

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

/** Fetch the cached AI news summary for one politician, or null if none. */
export async function getNewsSummary(
  politicianId: string
): Promise<PoliticianNewsSummary | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("politician_news_summaries")
    .select("*")
    .eq("politician_id", politicianId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as PoliticianNewsSummary;
  return {
    ...row,
    citations: Array.isArray(row.citations) ? row.citations : [],
  };
}
