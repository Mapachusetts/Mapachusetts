import type { Metadata } from "next";
import { getArticles } from "@/lib/articles";
import { formatDate } from "@/lib/format";
import type { Article } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "News — Mapachusetts",
  description: "Latest Massachusetts political news headlines, newest first.",
};

/** Newest first by publish date, falling back to when we stored it. */
function sortTime(a: Article): number {
  const published = a.published_at ? Date.parse(a.published_at) : Number.NaN;
  return Number.isNaN(published) ? Date.parse(a.created_at) : published;
}

export default async function NewsPage() {
  // If the table isn't reachable yet, show an empty state instead of crashing.
  let articles: Article[];
  try {
    articles = await getArticles(100);
  } catch {
    articles = [];
  }
  articles.sort((a, b) => sortTime(b) - sortTime(a));

  return (
    <section className="section">
      <h2>Latest Political News</h2>
      <p className="section-subtitle">
        Headlines behind our candidate summaries. Links open the original
        reporting.
      </p>

      {articles.length === 0 ? (
        <p className="tab-empty">
          No articles yet. Run <code>npm run ingest</code> to pull in headlines.
        </p>
      ) : (
        <ul className="news-list">
          {articles.map((a) => (
            <li key={a.id}>
              <a
                href={a.url}
                className="news-item"
                target="_blank"
                rel="noopener noreferrer"
              >
                <h3>{a.title}</h3>
                <div className="news-meta">
                  {[a.source, formatDate(a.published_at)]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                {a.snippet && <p className="news-snippet">{a.snippet}</p>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
