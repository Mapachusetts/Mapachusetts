// Relative imports (not the "@/" alias) so this runs under `tsx` with no
// extra path-resolution config: `npm run ingest`.
import { createServerClient } from "./supabase/server";
import type { NewArticle } from "./types";

/**
 * Feeds to ingest. Add more RSS 2.0 URLs here and they will be
 * fetched and parsed on the next ingest run.
 */
const FEED_URLS: string[] = ["https://rss.politico.com/congress.xml"];

/** Max length of a stored snippet, in characters. */
const SNIPPET_MAX = 500;

/** A single parsed <item> from an RSS feed (raw, pre-mapping). */
interface RssItem {
  title: string | null;
  link: string | null;
  description: string | null;
  pubDate: string | null;
}

/**
 * Pull every `<item>...</item>` block out of a raw RSS document.
 * Uses a non-greedy match so adjacent items are kept separate.
 */
function extractItems(xml: string): string[] {
  const items: string[] = [];
  const re = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    items.push(match[1]);
  }
  return items;
}

/**
 * Extract the inner text of the first `<tag>...</tag>` in a block.
 * Unwraps CDATA sections and returns a trimmed string, or null if absent.
 */
function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const match = re.exec(block);
  if (!match) return null;

  let value = match[1];
  // Unwrap one or more CDATA wrappers, e.g. <![CDATA[ ... ]]>.
  const cdata = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
  if (cdata.test(value)) {
    value = value.replace(cdata, "$1");
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Decode the handful of HTML entities that commonly appear in RSS text. */
function decodeEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    // Ampersand last so earlier entities decode correctly.
    .replace(/&amp;/g, "&");
}

/** Remove HTML tags, leaving plain text behind. */
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, "");
}

/**
 * Turn a raw RSS description into a clean plain-text snippet:
 * strip tags, decode entities, collapse whitespace, and truncate.
 */
function cleanSnippet(description: string | null): string | null {
  if (!description) return null;

  const text = decodeEntities(stripHtml(description))
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return null;
  return text.length > SNIPPET_MAX ? text.slice(0, SNIPPET_MAX) : text;
}

/** Best-effort source label: the hostname of the feed URL. */
function sourceFromFeed(feedUrl: string): string | null {
  try {
    return new URL(feedUrl).hostname;
  } catch {
    return null;
  }
}

/** Parse a raw RSS document into its list of items. */
function parseFeed(xml: string): RssItem[] {
  return extractItems(xml).map((block) => ({
    title: extractTag(block, "title"),
    link: extractTag(block, "link"),
    description: extractTag(block, "description"),
    pubDate: extractTag(block, "pubDate"),
  }));
}

/**
 * Fetch and parse a single feed into NewArticle rows.
 * Items without a link or title are skipped.
 */
async function ingestFeed(feedUrl: string): Promise<NewArticle[]> {
  const res = await fetch(feedUrl);
  if (!res.ok) {
    throw new Error(`Fetch failed (${res.status}) for ${feedUrl}`);
  }

  const xml = await res.text();
  const source = sourceFromFeed(feedUrl);
  const rows: NewArticle[] = [];

  for (const item of parseFeed(xml)) {
    const url = item.link ? decodeEntities(item.link).trim() : null;
    const title = item.title ? decodeEntities(item.title).trim() : null;
    if (!url || !title) continue;

    rows.push({
      url,
      title,
      snippet: cleanSnippet(item.description),
      source,
      published_at: item.pubDate,
    });
  }

  return rows;
}

/** De-duplicate rows by url, keeping the first occurrence. */
function dedupeByUrl(rows: NewArticle[]): NewArticle[] {
  const seen = new Set<string>();
  const out: NewArticle[] = [];
  for (const row of rows) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    out.push(row);
  }
  return out;
}

/**
 * Fetch, parse, and upsert articles from every feed in FEED_URLS.
 *
 * Resilient by design: a feed that fails to fetch or parse is logged
 * and skipped so the remaining feeds still ingest. Rows are de-duplicated
 * by url before a single upsert (onConflict: "url") into the "articles" table.
 *
 * @returns the number of articles stored or updated.
 */
export async function ingestArticles(): Promise<number> {
  const collected: NewArticle[] = [];

  for (const feedUrl of FEED_URLS) {
    try {
      const rows = await ingestFeed(feedUrl);
      collected.push(...rows);
    } catch (err) {
      console.warn(`Skipping feed ${feedUrl}:`, err);
    }
  }

  const rows = dedupeByUrl(collected);
  if (rows.length === 0) return 0;

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("articles")
    .upsert(rows, { onConflict: "url", ignoreDuplicates: false })
    .select("id");

  if (error) throw error;
  return data?.length ?? 0;
}

// Allow running directly: `npx tsx lib/ingest.ts` or via a wrapper script.
if (process.argv[1] && /ingest\.ts$/.test(process.argv[1])) {
  ingestArticles()
    .then((n) => {
      console.log(`Stored/updated ${n} articles.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Ingest failed:", err);
      process.exit(1);
    });
}
