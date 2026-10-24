// data/candidates.js
// The real political data for the globe UI: candidate research profiles and the
// races they are running in.
//
// WHERE THE DATA COMES FROM
//   The candidate research app (Next.js + Supabase, in app/ lib/ supabase/)
//   holds the source of truth:
//     supabase/seed-data/*.json   politician + cited news summary
//     lib/candidate-profiles.ts   curated funding / issues / career / sources / myths
//   `python3 scripts/export_candidates.py` converts both into
//   data/political-data.generated.js, which this module reads. This file ports
//   the merge logic from lib/candidates.ts (Supabase politician + curated
//   profile + news summary, joined by slug), so both apps show the same thing.
//
// TO ADD A CANDIDATE: add supabase/seed-data/<slug>.json (and optionally a
// profile in lib/candidate-profiles.ts), re-run the export script, then list
// them in a race in RACES below.
//
// Shapes are documented in data/types.js (CandidateView, Race).

import {
  POLITICIANS,
  NEWS_SUMMARIES,
  CANDIDATE_PROFILES,
} from "./political-data.generated.js";

// ----- Merge (ported from lib/candidates.ts) ---------------------------------

/** Normalize a year range for matching ("2013–present" ≈ "2013-present"). */
function yearsKey(years) {
  return String(years)
    .replace(/[\u2012-\u2015]/g, "-")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** First 4-digit year in a period like "1990s-2004", for sorting. */
function startYear(period) {
  const match = /\d{4}/.exec(period);
  return match ? Number(match[0]) : 0;
}

/** Same party label for curated and database records. */
function normalizeParty(party) {
  const value = String(party ?? "").trim();
  return value.toLowerCase() === "democrat" ? "Democratic" : value;
}

/**
 * Database career rows -> Career-tab entries, most recent first. Where a
 * curated profile has a role with the same years, its organization and
 * plain-English description are attached.
 */
function mergeCareer(dbCareer, profileCareer = []) {
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

function fromProfileOnly(profile) {
  return {
    slug: profile.slug,
    name: profile.name,
    role: profile.role,
    party: normalizeParty(profile.party),
    bio: null,
    photo: profile.photo ?? null,
    status: profile.status ?? null,
    openSecretsUrl: profile.openSecretsUrl ?? null,
    career: profile.career ?? [],
    funding: profile.funding ?? null,
    opinions: profile.opinions ?? [],
    sources: profile.sources ?? [],
    misconceptions: profile.misconceptions ?? [],
    news: null,
  };
}

function fromPolitician(p, profile, news) {
  const dbCareer = Array.isArray(p.career_history) ? p.career_history : [];
  return {
    slug: p.slug,
    name: p.name,
    role: p.current_office ?? profile?.role ?? "",
    party: normalizeParty(p.party ?? profile?.party),
    bio: p.bio ?? null,
    photo: profile?.photo ?? null,
    status: profile?.status ?? null,
    openSecretsUrl: profile?.openSecretsUrl ?? null,
    career: mergeCareer(dbCareer, profile?.career),
    funding: profile?.funding ?? null,
    opinions: profile?.opinions ?? [],
    sources: profile?.sources ?? [],
    misconceptions: profile?.misconceptions ?? [],
    news: news ?? null,
  };
}

function buildViews() {
  const profiles = new Map(CANDIDATE_PROFILES.map((c) => [c.slug, c]));
  const views = POLITICIANS.map((p) => {
    const profile = profiles.get(p.slug);
    profiles.delete(p.slug);
    return fromPolitician(p, profile, NEWS_SUMMARIES[p.slug]);
  });
  // Curated profiles that don't have a politician row yet.
  for (const profile of profiles.values()) views.push(fromProfileOnly(profile));
  return views.sort((a, b) => a.name.localeCompare(b.name));
}

const VIEWS = buildViews();
const BY_SLUG = new Map(VIEWS.map((v) => [v.slug, v]));

// ----- Lookups ----------------------------------------------------------------

/** Every candidate profile we have, A to Z. */
export function getCandidates() {
  return VIEWS;
}

export function getCandidate(slug) {
  return BY_SLUG.get(slug) || null;
}

/** Name / office / party search for the search box. */
export function searchCandidates(query, limit = 4) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) return [];
  return VIEWS.filter((c) =>
    [c.name, c.role, c.party].some((field) => String(field || "").toLowerCase().includes(q))
  ).slice(0, limit);
}

/** Initials for the avatar fallback ("Maura Healey" -> "MH"). */
export function initials(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// ----- Races: who is running for what -----------------------------------------
//
// This is the link between the candidate research data and the ballot. Each
// race lists candidate SLUGS (from supabase/seed-data); names and parties are
// read from the profiles above so there is only one place to edit them.
//
// Source of the pairings: the candidate bios in supabase/seed-data/*.json
// (Healey vs. Minogue for governor; Markey vs. Deaton for U.S. Senate).

const GENERAL_ELECTION_2026 = "2026-11-03";
const RESEARCH_SOURCE = "Candidate research (Oct 2026)";

export const RACES = [
  {
    id: "ma-governor-2026",
    state: "MA",
    office: "Governor of Massachusetts",
    kind: "state",
    category: "executive",
    term: "4 years",
    electionDate: GENERAL_ELECTION_2026,
    candidates: ["maura-healey", "mike-minogue"],
    description: "Statewide race for governor on the November 2026 ballot.",
  },
  {
    id: "ma-senate-2026",
    state: "MA",
    office: "U.S. Senator (Massachusetts)",
    kind: "state",
    category: "legislative",
    term: "6 years",
    electionDate: GENERAL_ELECTION_2026,
    candidates: ["ed-markey", "john-deaton"],
    description: "Statewide race for one of Massachusetts's two U.S. Senate seats.",
  },
];

/**
 * Race objects (see data/types.js) for a state, with real candidates. Each
 * candidate carries a `slug` so the UI can open their profile.
 * @param {string} stateCode  USPS code, e.g. "MA"
 */
export function racesForState(stateCode) {
  return RACES.filter((r) => r.state === stateCode).map((r) => ({
    id: r.id,
    office: r.office,
    kind: r.kind,
    category: r.category,
    term: r.term,
    electionDate: r.electionDate,
    description: r.description,
    source: RESEARCH_SOURCE,
    candidates: r.candidates.map((slug) => {
      const c = BY_SLUG.get(slug);
      return { slug, name: c ? c.name : slug, party: c ? c.party : null };
    }),
  }));
}

/** True when we have real candidate data for this state's statewide races. */
export function hasRealRaces(stateCode) {
  return RACES.some((r) => r.state === stateCode);
}
