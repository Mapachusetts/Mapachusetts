import type { Metadata } from "next";
import { getArticles } from "@/lib/articles";
import type { Article } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "News — Mapachusetts",
  description: "Latest political news headlines, newest first.",
};

/** Format an RSS pubDate (or ISO string) for display; fall back to raw text. */
function formatDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function NewsPage() {
  // If the table isn't reachable yet, show an empty state instead of crashing.
  let articles: Article[];
  try {
    articles = await getArticles(50);
  } catch {
    articles = [];
  }

  return (
    <div className="container">
      <h1 className="section-title">Latest Political News</h1>

      {articles.length === 0 ? (
        <p className="empty">
          No articles yet. Run <code>npm run ingest</code> to pull in headlines.
        </p>
      ) : (
        <div className="news-list">
          {articles.map((a) => {
            const date = formatDate(a.published_at);
            return (
              <a
                key={a.id}
                href={a.url}
                className="news-item"
                target="_blank"
                rel="noopener noreferrer"
              >
                <h3>{a.title}</h3>
                <div className="meta">
                  {[a.source, date].filter(Boolean).join(" · ")}
                </div>
                {a.snippet && <p className="news-snippet">{a.snippet}</p>}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
