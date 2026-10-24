import Link from "next/link";

export default function NotFound() {
  return (
    <section className="section">
      <h2>Not found</h2>
      <p className="section-subtitle">That page could not be found.</p>
      <Link href="/candidates" className="btn">
        Browse candidates
      </Link>
    </section>
  );
}
