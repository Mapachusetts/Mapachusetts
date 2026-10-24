export default function AboutPage() {
  return (
    <div className="container">
      <h1 className="section-title">About Mapachusetts</h1>
      <p className="bio">
        Mapachusetts is a simple directory for searching politicians and viewing
        their career history. Each politician has their own page with a timeline
        of the offices and roles they have held.
      </p>
      <p className="bio">
        Data is stored in Supabase (Postgres). Replace the sample records with
        your own via the Supabase dashboard or a data import.
      </p>
    </div>
  );
}
