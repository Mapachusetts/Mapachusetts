import { getNewsSummaries } from "@/lib/articles";
import { CANDIDATE_PROFILES } from "@/lib/candidate-profiles";
import { getAllPoliticians } from "@/lib/politicians";
import type {
  CandidateProfile,
  CandidateView,
  CareerEntry,
  Politician,
  PoliticianNewsSummary,
  ProfileCareerEntry,
} from "@/lib/types";

/** Normalize a year range for matching ("2013–present" ≈ "2013-present"). */
function yearsKey(years: string): string {
  return years
    .replace(/[\u2012-\u2015]/g, "-")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** First 4-digit year in a period like "1990s-2004", for sorting. */
function startYear(period: string): number {
  const match = /\d{4}/.exec(period);
  return match ? Number(match[0]) : 0;
}

/** Display the same party label for curated and Supabase records. */
function normalizeParty(party: string | null | undefined): string {
  const value = (party ?? "").trim();
  return value.toLowerCase() === "democrat" ? "Democratic" : value;
}

/**
 * Supabase career rows → Career-tab entries, most recent first. Where a
 * curated profile has a role with the same years, its organization and
 * plain-English description are attached. Falls back to the curated career.
 */
function mergeCareer(
  dbCareer: CareerEntry[],
  profileCareer: ProfileCareerEntry[] = []
): ProfileCareerEntry[] {
  if (dbCareer.length === 0) return profileCareer;

  const byYears = new Map(profileCareer.map((e) => [yearsKey(e.years), e]));
  return [...dbCareer]
    .sort((a, b) => startYear(b.period) - startYear(a.period))
    .map((entry) => {
      const match = byYears.get(yearsKey(entry.period));
      return {
        years: entry.period,
        title: entry.role,
        org: match?.org ?? "",
        description: entry.notes ?? match?.description ?? "",
      };
    });
}

function fromProfileOnly(profile: CandidateProfile): CandidateView {
  return {
    slug: profile.slug,
    name: profile.name,
    role: profile.role,
    party: normalizeParty(profile.party),
    bio: null,
    openSecretsUrl: profile.openSecretsUrl ?? null,
    career: profile.career ?? [],
    funding: profile.funding ?? null,
    opinions: profile.opinions ?? [],
    sources: profile.sources ?? [],
    misconceptions: profile.misconceptions ?? [],
    news: null,
  };
}

function fromPolitician(
  p: Politician,
  profile: CandidateProfile | undefined,
  news: PoliticianNewsSummary | undefined
): CandidateView {
  const dbCareer = Array.isArray(p.career_history) ? p.career_history : [];
  return {
    slug: p.slug,
    name: p.name,
    role: p.current_office ?? profile?.role ?? "",
    party: normalizeParty(p.party ?? profile?.party),
    bio: p.bio,
    openSecretsUrl: profile?.openSecretsUrl ?? null,
    career: mergeCareer(dbCareer, profile?.career),
    funding: profile?.funding ?? null,
    opinions: profile?.opinions ?? [],
    sources: profile?.sources ?? [],
    misconceptions: profile?.misconceptions ?? [],
    news: news ?? null,
  };
}

/**
 * Every candidate the research UI can show: Supabase politicians (with their
 * cited news summaries) merged with curated profiles by slug. If Supabase is
 * unreachable, the curated profiles still render. Server-only.
 */
export async function getCandidates(): Promise<CandidateView[]> {
  const [politicians, summaries] = await Promise.all([
    getAllPoliticians().catch((err: unknown): Politician[] => {
      console.error("Could not load politicians from Supabase:", err);
      return [];
    }),
    getNewsSummaries().catch((err: unknown): PoliticianNewsSummary[] => {
      console.error("Could not load news summaries from Supabase:", err);
      return [];
    }),
  ]);

  const profiles = new Map(CANDIDATE_PROFILES.map((c) => [c.slug, c]));
  const newsByPolitician = new Map(summaries.map((s) => [s.politician_id, s]));

  const views = politicians.map((p) => {
    const profile = profiles.get(p.slug);
    profiles.delete(p.slug);
    return fromPolitician(p, profile, newsByPolitician.get(p.id));
  });

  // Curated profiles that don't have a Supabase row yet.
  for (const profile of profiles.values()) {
    views.push(fromProfileOnly(profile));
  }

  return views.sort((a, b) => a.name.localeCompare(b.name));
}
