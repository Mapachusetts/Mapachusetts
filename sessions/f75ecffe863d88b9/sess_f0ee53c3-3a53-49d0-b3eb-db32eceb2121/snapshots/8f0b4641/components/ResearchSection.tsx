import CandidateResearch from "@/components/CandidateResearch";
import type { CandidateView } from "@/lib/types";

/** The "Candidate Research" block shared by /candidates and /candidates/[slug]. */
export default function ResearchSection({
  candidates,
  initialSlug,
}: {
  candidates: CandidateView[];
  initialSlug: string | null;
}) {
  return (
    <section id="research" className="section research-section">
      <h2>Candidate Research</h2>
      <p className="section-subtitle">
        Search a candidate by name, office, or party to explore their record.
        Prefer a map? <a href="/">Find your races on the globe</a>.
      </p>
      <CandidateResearch candidates={candidates} initialSlug={initialSlug} />
    </section>
  );
}
