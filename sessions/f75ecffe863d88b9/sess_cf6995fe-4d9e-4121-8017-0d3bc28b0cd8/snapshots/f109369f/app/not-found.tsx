import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container">
      <h1 className="section-title">Not found</h1>
      <p className="bio">That politician could not be found.</p>
      <Link href="/" className="btn">
        Back to search
      </Link>
    </div>
  );
}
