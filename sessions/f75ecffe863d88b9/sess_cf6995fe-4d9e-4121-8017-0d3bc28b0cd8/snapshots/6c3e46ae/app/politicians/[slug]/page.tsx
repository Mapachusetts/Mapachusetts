import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllSlugs, getPoliticianBySlug } from "@/lib/politicians";
import type { CareerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

// Pre-generate a static page per politician at build time.
export async function generateStaticParams() {
  const slugs = await getAllSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const politician = await getPoliticianBySlug(params.slug);
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
  params: { slug: string };
}) {
  const politician = await getPoliticianBySlug(params.slug);
  if (!politician) notFound();

  const career: CareerEntry[] = Array.isArray(politician.career_history)
    ? politician.career_history
    : [];

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
    </div>
  );
}
