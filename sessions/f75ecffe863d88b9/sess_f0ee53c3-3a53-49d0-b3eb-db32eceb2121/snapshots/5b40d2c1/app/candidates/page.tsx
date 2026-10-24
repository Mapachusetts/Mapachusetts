import type { Metadata } from "next";
import ResearchSection from "@/components/ResearchSection";
import { getCandidates } from "@/lib/candidates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Candidates — Mapachusetts",
  description:
    "Research Massachusetts candidates: cited news summaries, funding, issue positions, and career history.",
};

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ candidate?: string }>;
}) {
  const { candidate } = await searchParams;
  const candidates = await getCandidates();

  return (
    <>
      <section id="home" className="hero">
        <h1>Know Your Candidates</h1>
        <p>
          Search any Massachusetts candidate to see their recent news coverage,
          funding, issue positions, and career history — all in one place.
        </p>
        <a href="#research" className="btn">
          Start Researching
        </a>
      </section>

      <ResearchSection candidates={candidates} initialSlug={candidate ?? null} />

      <section id="about" className="section">
        <h2>About Mapachusetts</h2>
        <p>
          Mapachusetts is a civic transparency tool built to make Massachusetts
          political information accessible to everyone — regardless of how
          closely you follow the news. We pull from public records, campaign
          finance filings, legislative data, and recent news coverage to give
          you a clear, unbiased picture of who represents you and how they act
          on it.
        </p>
        <p className="about-note">
          News summaries are generated from recent reporting and cite every
          article they draw on. We store headlines, links, and short
          paraphrased snippets, never full article text.
        </p>
      </section>

      <section id="contact" className="section section-alt">
        <h2>Contact</h2>
        <p>
          Have a tip, correction, or want to contribute? Reach out at{" "}
          <a href="mailto:hello@mapachusetts.org">hello@mapachusetts.org</a>.
        </p>
      </section>
    </>
  );
}
