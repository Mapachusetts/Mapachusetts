// Relative imports (not the "@/" alias) so this runs under `tsx` with no
// extra path-resolution config: `npx tsx lib/summarize.ts`.
import { createServerClient } from "./supabase/server";
import type { Article, Citation, Politician } from "./types";

/** How many of the newest articles to process per run. */
const ARTICLE_LIMIT = 100;

/** Max length of extracted article text kept in memory, in characters. */
const BODY_MAX = 6000;

/** Paragraphs shorter than this are treated as boilerplate and dropped. */
const MIN_PARAGRAPH = 40;

/** Max number of matched articles fed to the model per politician. */
const SOURCES_PER_POLITICIAN = 8;

/** Approximate max length of each per-source excerpt, in characters. */
const EXCERPT_MAX = 1500;

/** Parallel article page fetches. */
const FETCH_CONCURRENCY = 4;

const USER_AGENT =
  "Mozilla/5.0 (compatible; MapachusettsBot/0.1; +https://github.com/)";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TOKENS = 1200;
const RETRY_DELAY_MS = 5000;

const SYSTEM_PROMPT = [
  "You are a neutral, nonpartisan journalist writing a brief news summary about one specific politician.",
  "Summarize ONLY what the provided numbered sources say about this specific politician: their actions, statements, positions they have explicitly stated, and events involving them.",
  "Every sentence must end with one or more citation markers referring to the source numbers, like [1] or [2][3].",
  "Do not infer, speculate, or editorialize about political views that are not explicitly reported in the sources.",
  "Do not use any outside knowledge; rely solely on the provided sources.",
  "If the sources say little about the person, say so briefly.",
  "Write 2-4 short paragraphs in plain text. No markdown, no headers, no bullet points.",
].join(" ");

type PoliticianRef = Pick<Politician, "id" | "name">;
type ArticleRow = Pick<
  Article,
  "id" | "url" | "title" | "snippet" | "source" | "published_at"
>;

/** An article plus its in-memory extracted text. Never persisted. */
interface ProcessedArticle {
  article: ArticleRow;
  /** Extracted body text (or title + snippet fallback). Memory only. */
  text: string;
}

/** A numbered source handed to the model. */
interface NumberedSource {
  n: number;
  article: ArticleRow;
  excerpt: string;
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/** Resolve after `ms` milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Map over `items` with at most `limit` promises in flight.
 * Results keep the input order.
 */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/** Narrow unknown to a plain object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Escape a string for literal use inside a RegExp. */
function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// HTML text extraction (dependency-free)
// ---------------------------------------------------------------------------

/** Decode common named entities plus numeric (&#NNN; / &#xHH;) entities. */
function decodeEntities(input: string): string {
  const fromCode = (code: number, raw: string): string =>
    Number.isFinite(code) && code >= 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : raw;

  return input
    .replace(/&#x([0-9a-f]+);/gi, (raw, hex: string) =>
      fromCode(parseInt(hex, 16), raw)
    )
    .replace(/&#(\d+);/g, (raw, dec: string) => fromCode(parseInt(dec, 10), raw))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Ampersand last so earlier entities decode correctly.
    .replace(/&amp;/g, "&");
}

/** Remove HTML tags, leaving plain text behind. */
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, " ");
}

/** Collapse runs of whitespace to single spaces and trim. */
function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/** Recursively search a parsed JSON-LD value for a string `articleBody`. */
function findArticleBody(node: unknown): string | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findArticleBody(child);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(node)) return null;

  const body = node["articleBody"];
  if (typeof body === "string" && body.trim().length > 0) return body;

  // Covers "@graph" and any other nested objects/arrays.
  for (const value of Object.values(node)) {
    if (typeof value === "object" && value !== null) {
      const found = findArticleBody(value);
      if (found) return found;
    }
  }
  return null;
}

/** Try to pull `articleBody` out of any JSON-LD script blocks. */
function extractFromJsonLd(html: string): string | null {
  const re =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    try {
      const parsed: unknown = JSON.parse(match[1].trim());
      const body = findArticleBody(parsed);
      if (body) return decodeEntities(stripHtml(body));
    } catch {
      // Malformed JSON-LD is common; try the next block.
    }
  }
  return null;
}

/** Collect <p> text after removing non-content blocks. */
function extractFromParagraphs(html: string): string | null {
  let cleaned = html;
  for (const tag of ["script", "style", "nav", "header", "footer", "aside"]) {
    const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    cleaned = cleaned.replace(re, " ");
  }

  const paragraphs: string[] = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned)) !== null) {
    const text = collapseWhitespace(decodeEntities(stripHtml(match[1])));
    if (text.length >= MIN_PARAGRAPH) paragraphs.push(text);
  }

  return paragraphs.length > 0 ? paragraphs.join("\n") : null;
}

/** Extract article body text from raw HTML, truncated to BODY_MAX. */
function extractBodyText(html: string): string {
  const raw = extractFromJsonLd(html) ?? extractFromParagraphs(html) ?? "";
  const text = collapseWhitespace(raw);
  return text.length > BODY_MAX ? text.slice(0, BODY_MAX) : text;
}

/** Title + snippet, used when the page can't be fetched or parsed. */
function fallbackText(article: ArticleRow): string {
  return collapseWhitespace(`${article.title}. ${article.snippet ?? ""}`);
}

/**
 * Fetch an article page and extract its text, in memory only.
 * Falls back to title + snippet on any failure.
 */
async function processArticle(article: ArticleRow): Promise<ProcessedArticle> {
  try {
    const res = await fetch(article.url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = extractBodyText(await res.text());
    if (!text) throw new Error("no extractable text");
    return { article, text };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`Using title/snippet for ${article.url}: ${reason}`);
    return { article, text: fallbackText(article) };
  }
}

// ---------------------------------------------------------------------------
// Politician matching + excerpts
// ---------------------------------------------------------------------------

/**
 * Case-insensitive regex for a full name, with flexible whitespace between
 * parts and word boundaries that also work for names ending in "." etc.
 */
function nameRegex(name: string): RegExp | null {
  const parts = name.trim().split(/\s+/).filter(Boolean).map(escapeRegex);
  if (parts.length === 0) return null;
  return new RegExp(`(?<![\\w])${parts.join("\\s+")}(?![\\w])`, "i");
}

/** Text searched for name mentions: title + snippet + extracted body. */
function searchableText(p: ProcessedArticle): string {
  return `${p.article.title}\n${p.article.snippet ?? ""}\n${p.text}`;
}

/** Split text into rough sentences. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Build an excerpt of up to ~EXCERPT_MAX chars, preferring sentences that
 * mention the politician plus their immediate neighbors.
 */
function buildExcerpt(text: string, re: RegExp): string {
  const sentences = splitSentences(text);
  const keep = new Set<number>();
  sentences.forEach((s, i) => {
    if (re.test(s)) {
      if (i > 0) keep.add(i - 1);
      keep.add(i);
      if (i < sentences.length - 1) keep.add(i + 1);
    }
  });

  if (keep.size === 0) return text.slice(0, EXCERPT_MAX);

  const chosen: string[] = [];
  let length = 0;
  for (const i of [...keep].sort((a, b) => a - b)) {
    const s = sentences[i];
    if (length + s.length > EXCERPT_MAX && chosen.length > 0) break;
    chosen.push(s);
    length += s.length + 1;
  }
  const excerpt = chosen.join(" ");
  return excerpt.length > EXCERPT_MAX ? excerpt.slice(0, EXCERPT_MAX) : excerpt;
}

/** Render numbered sources as the user message for the model. */
function buildUserContent(name: string, sources: NumberedSource[]): string {
  const blocks = sources.map((s) =>
    [
      `[${s.n}] ${s.article.title}`,
      `Source: ${s.article.source ?? "unknown"}`,
      `Published: ${s.article.published_at ?? "unknown"}`,
      `URL: ${s.article.url}`,
      `Excerpt: ${s.excerpt}`,
    ].join("\n")
  );
  return [
    `Politician: ${name}`,
    "",
    "Sources:",
    "",
    blocks.join("\n\n"),
    "",
    `Write the cited summary of recent coverage about ${name}.`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Anthropic API
// ---------------------------------------------------------------------------

/** Concatenate all text blocks from an Anthropic Messages API response. */
function extractResponseText(body: unknown): string {
  if (!isRecord(body) || !Array.isArray(body["content"])) return "";
  const parts: string[] = [];
  for (const block of body["content"]) {
    if (isRecord(block) && block["type"] === "text") {
      const text = block["text"];
      if (typeof text === "string") parts.push(text);
    }
  }
  return parts.join("").trim();
}

/** Whether an HTTP status should be retried once. */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Call the Anthropic Messages API and return the concatenated text.
 * Retries once after RETRY_DELAY_MS on 429/5xx.
 */
async function callClaude(
  apiKey: string,
  model: string,
  content: string
): Promise<string> {
  const request = (): Promise<Response> =>
    fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      }),
    });

  let res = await request();
  if (isRetryable(res.status)) {
    console.warn(`Anthropic returned ${res.status}; retrying in 5s...`);
    await sleep(RETRY_DELAY_MS);
    res = await request();
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${detail}`);
  }

  const body: unknown = await res.json();
  return extractResponseText(body);
}

// ---------------------------------------------------------------------------
// Citation validation
// ---------------------------------------------------------------------------

/**
 * Keep only citations for [n] markers that actually appear in the summary
 * and refer to a real source, in numeric order (original numbering kept).
 */
function buildCitations(summary: string, sources: NumberedSource[]): Citation[] {
  const byNumber = new Map(sources.map((s) => [s.n, s]));
  const cited = new Set<number>();
  for (const match of summary.matchAll(/\[(\d+)\]/g)) {
    const n = parseInt(match[1], 10);
    if (byNumber.has(n)) cited.add(n);
  }

  return [...cited]
    .sort((a, b) => a - b)
    .map((n) => {
      const { article } = byNumber.get(n) as NumberedSource;
      return {
        n,
        title: article.title,
        url: article.url,
        source: article.source,
        published_at: article.published_at,
      };
    });
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/**
 * Fetch recent articles, link them to politicians they mention, and write
 * a cited AI summary of coverage for each matched politician.
 *
 * Article body text is kept in memory only and never written to the DB.
 */
export async function summarizeNews(): Promise<{
  articlesProcessed: number;
  summariesWritten: number;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY env var; cannot summarize news.");
  }
  const model = process.env.SUMMARY_MODEL ?? "claude-sonnet-5-5";

  const supabase = createServerClient();

  // 1. Load politicians and recent articles.
  const { data: polData, error: polError } = await supabase
    .from("politicians")
    .select("id, name");
  if (polError) throw polError;
  const politicians = (polData ?? []) as PoliticianRef[];

  const { data: artData, error: artError } = await supabase
    .from("articles")
    .select("id, url, title, snippet, source, published_at")
    .order("created_at", { ascending: false })
    .limit(ARTICLE_LIMIT);
  if (artError) throw artError;
  const articles = (artData ?? []) as ArticleRow[];

  console.log(
    `Loaded ${politicians.length} politicians and ${articles.length} articles.`
  );

  // 2. Fetch + extract article text (in memory only).
  const processed = await mapPool(articles, FETCH_CONCURRENCY, processArticle);

  // 3. Match politicians to articles (processed is newest-first).
  const matchesByPolitician = new Map<string, ProcessedArticle[]>();
  const links: { article_id: number; politician_id: string }[] = [];

  for (const pol of politicians) {
    const re = nameRegex(pol.name);
    if (!re) continue;
    const matched = processed.filter((p) => re.test(searchableText(p)));
    if (matched.length === 0) continue;
    matchesByPolitician.set(pol.id, matched);
    for (const p of matched) {
      links.push({ article_id: p.article.id, politician_id: pol.id });
    }
  }

  if (links.length > 0) {
    const { error } = await supabase
      .from("article_politicians")
      .upsert(links, {
        onConflict: "article_id,politician_id",
        ignoreDuplicates: true,
      });
    if (error) throw error;
  }
  console.log(
    `Linked ${links.length} article/politician pairs across ${matchesByPolitician.size} politicians.`
  );

  // 4-7. Summarize each matched politician sequentially.
  let summariesWritten = 0;
  for (const pol of politicians) {
    const matched = matchesByPolitician.get(pol.id);
    const re = nameRegex(pol.name);
    if (!matched || !re) continue;

    const used = matched.slice(0, SOURCES_PER_POLITICIAN);
    const sources: NumberedSource[] = used.map((p, i) => ({
      n: i + 1,
      article: p.article,
      excerpt: buildExcerpt(p.text, re),
    }));

    console.log(`Summarizing ${pol.name} from ${sources.length} source(s)...`);
    const summary = await callClaude(
      apiKey,
      model,
      buildUserContent(pol.name, sources)
    );
    if (!summary) {
      console.warn(`Empty summary for ${pol.name}; skipping.`);
      continue;
    }

    const citations = buildCitations(summary, sources);
    const { error } = await supabase.from("politician_news_summaries").upsert(
      {
        politician_id: pol.id,
        summary,
        citations,
        article_count: used.length,
        model,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "politician_id" }
    );
    if (error) throw error;

    summariesWritten++;
    console.log(`Wrote summary for ${pol.name} (${citations.length} citations).`);
  }

  return { articlesProcessed: processed.length, summariesWritten };
}

// Allow running directly: `npx tsx lib/summarize.ts` or via a wrapper script.
if (process.argv[1] && /summarize\.ts$/.test(process.argv[1])) {
  summarizeNews()
    .then((r) => {
      console.log(
        `Processed ${r.articlesProcessed} articles, wrote ${r.summariesWritten} summaries.`
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("Summarize failed:", err);
      process.exit(1);
    });
}
