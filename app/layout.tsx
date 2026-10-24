import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mapachusetts — Know Your Candidates",
  description:
    "Research Massachusetts candidates: cited news summaries, funding, issue positions, and career history.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Navbar />
        <main>{children}</main>
        <footer className="footer">
          <p>&copy; 2026 Mapachusetts. Built for civic transparency.</p>
        </footer>
      </body>
    </html>
  );
}
