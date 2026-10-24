import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllSlugs, getPoliticianBySlug } from "@/lib/politicians";
import { getNewsSummary } from "@/lib/articles";
import type { CareerEntry, PoliticianNewsSummary } from "@/lib/types";
import CitedText from "./CitedText";

export const dynamic = "force-dynamic";

/** Format an ISO/RSS date for display; fall back to raw text. */
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

// Pre-generate a static page per politician at build time.
// Pages also render on-demand (force-dynamic), so if the DB/table isn't
// reachable at build time we simply skip pre-generation instead of failing.
export async function generateStaticParams() {
  try {
    const slugs = await getAllSlugs();
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const politician = await getPoliticianBySlug(slug);
  if (!politician) return { title: "Not found — Mapachusetts" };
  return {
    title: `${politician.name} — Mapachusetts`,
    description:
      politician.bio ?? `Career history for ${politician.name}.`,
  };
}

export default async function PoliticianPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const politician = await getPoliticianBySlug(slug);
  if (!politician) notFound();

  const career: CareerEntry[] = Array.isArray(politician.career_history)
    ? politician.career_history
    : [];

  // If the summaries table isn't reachable yet, render without it.
  let news: PoliticianNewsSummary | null;
  try {
    news = await getNewsSummary(politician.id);
  } catch {
    news = null;
  }
  const citationNumbers = new Set((news?.citations ?? []).map((c) => c.n));

  return (
    <div className="container">
      <Link href="/" className="back-link">
        ← Back to search
      </Link>

      <div className="profile-header">
        <h1>{politician.name}</h1>
        <div className="badges">
          {politician.current_office && (
            <span className="badge">{politician.current_office}</span>
          )}
          {politician.party && <span className="badge">{politician.party}</span>}
          {politician.state && <span className="badge">{politician.state}</span>}
        </div>
      </div>

      {politician.bio && <p className="bio">{politician.bio}</p>}

      <h2 className="section-title">Career History</h2>
      {career.length === 0 ? (
        <p className="empty">No career history recorded.</p>
      ) : (
        <div className="timeline">
          {career.map((entry, i) => (
            <div className="timeline-item" key={i}>
              <div className="timeline-period">{entry.period}</div>
              <div className="timeline-role">{entry.role}</div>
              {entry.notes && (
                <div className="timeline-notes">{entry.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <section aria-labelledby="in-the-news">
        <h2 className="section-title" id="in-the-news" style={{ marginTop: "2.5rem" }}>
          In the News
        </h2>
        {!news ? (
          <p className="empty">No recent news coverage summarized yet.</p>
        ) : (
          <>
            <p className="news-disclaimer">
              AI-generated summary of recent news coverage. Verify claims using
              the linked sources.
              {formatDate(news.generated_at) && (
                <> Updated {formatDate(news.generated_at)}.</>
              )}
            </p>

            <CitedText text={news.summary} validNumbers={citationNumbers} />

            {news.citations.length > 0 && (
              <>
                <h3>Sources</h3>
                <ol className="citations">
                  {news.citations.map((c) => {
                    const meta = [c.source, formatDate(c.published_at)]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <li id={`cite-${c.n}`} value={c.n} key={c.n}>
                        <a href={c.url} target="_blank" rel="noopener noreferrer">
                          {c.title}
                        </a>
                        {meta && <span className="meta-inline">{meta}</span>}
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
