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

/** All cached AI news summaries (at most one per politician). */
export async function getNewsSummaries(): Promise<PoliticianNewsSummary[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("politician_news_summaries")
    .select("*");

  if (error) throw error;
  return ((data ?? []) as PoliticianNewsSummary[]).map((row) => ({
    ...row,
    citations: Array.isArray(row.citations) ? row.citations : [],
  }));
}
