import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ResearchSection from "@/components/ResearchSection";
import { getCandidates } from "@/lib/candidates";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const candidate = (await getCandidates()).find((c) => c.slug === slug);
  if (!candidate) return { title: "Candidate not found — Mapachusetts" };
  return {
    title: `${candidate.name} — Mapachusetts`,
    description:
      candidate.bio ??
      `Research ${candidate.name}: news coverage, funding, issues, and career history.`,
  };
}

/** One candidate's research profile, opened directly (links from the globe). */
export default async function CandidatePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const candidates = await getCandidates();
  if (!candidates.some((c) => c.slug === slug)) notFound();

  return <ResearchSection candidates={candidates} initialSlug={slug} />;
}
