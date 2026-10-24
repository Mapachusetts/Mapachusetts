import Link from "next/link";
import { searchPoliticians } from "@/lib/politicians";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const query = searchParams.q ?? "";
  const results = await searchPoliticians(query);

  return (
    <>
      <section className="hero">
        <h1>Politician Career Histories</h1>
        <p>Search by name, office, state, or party.</p>
        <form className="search-form" action="/" method="get">
          <input
            className="search-input"
            type="text"
            name="q"
            placeholder="Search politicians…"
            defaultValue={query}
            autoFocus
          />
          <button className="btn" type="submit">
            Search
          </button>
        </form>
      </section>

      <div className="container">
        {results.length === 0 ? (
          <p className="empty">
            {query
              ? `No politicians found for “${query}”.`
              : "No politicians yet."}
          </p>
        ) : (
          <div className="results">
            {results.map((p) => (
              <Link key={p.id} href={`/politicians/${p.slug}`} className="card">
                <h3>{p.name}</h3>
                <div className="meta">
                  {[p.current_office, p.party, p.state]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
