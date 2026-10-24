import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mapachusetts — Politician Career Histories",
  description: "Search politicians and view their career history.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="navbar">
          <div className="navbar-container">
            <Link href="/" className="navbar-brand">
              Mapachusetts
            </Link>
            <nav className="navbar-links">
              <Link href="/">Search</Link>
              <Link href="/news">News</Link>
              <Link href="/about">About</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
