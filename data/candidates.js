// data/candidates.js
// Every candidate we have real data for, and the races they are running in.
//
// WHAT IS IN HERE (all real, none invented)
//   Nominees   U.S. Senate, Governor and U.S. House: every race, every state
//              (data/nominees.generated.js, built by scripts/export_nominees.py
//              from Wikipedia's election pages + FEC candidate files)
//   Money      FEC campaign-finance totals for each Senate/House nominee
//              (same file)
//   Research   cited news summaries, careers, issue positions, sources and myths
//              for the candidates the research team has profiled
//              (data/political-data.generated.js, built by
//              scripts/export_candidates.py from supabase/seed-data/*.json and
//              lib/candidate-profiles.ts)
//
// NOT in here (no free national source exists): candidates for state
// legislature, county, city and school-board races. The UI says so and points
// people to official ballot tools instead of showing blank or made-up names.
//
// Shapes: CandidateView and Race in data/types.js.

import { POLITICIANS, NEWS_SUMMARIES, CANDIDATE_PROFILES } from "./political-data.generated.js";
import { NOMINEES, NOMINEES_META } from "./nominees.generated.js";

export { NOMINEES_META };

// ----- Small helpers ----------------------------------------------------------

/** "Ed Markey" -> "ed-markey"; accents and punctuation removed. */
export function slugify(name) {
  return String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function initials(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** "Maura Healey" is matched against "maura healey" etc. */
const norm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

// ----- Races: titles and wording ----------------------------------------------

const STATE_NAMES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas",
  KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts",
  MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota",
  TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

/** Governors serve 2-year terms in New Hampshire and Vermont, 4 years elsewhere. */
const governorTerm = (state) => (state === "NH" || state === "VT" ? "2 years" : "4 years");

/** { office, kind, category, term, description } for a nominee-file race. */
function raceText(race) {
  const stateName = STATE_NAMES[race.state] || race.state;
  if (race.office === "senate") {
    return {
      office: race.special ? `U.S. Senator (${stateName}), special election` : `U.S. Senator (${stateName})`,
      kind: "state",
      category: "legislative",
      term: race.special ? "rest of the current term" : "6 years",
      description: race.special
        ? `A special election to fill a U.S. Senate seat that came open early. The winner serves the rest of the term.`
        : `Represents all of ${stateName} in the U.S. Senate.`,
    };
  }
  if (race.office === "governor") {
    return {
      office: `Governor of ${stateName}`,
      kind: "state",
      category: "executive",
      term: governorTerm(race.state),
      description: `The top elected executive of ${stateName}.`,
    };
  }
  const label = race.district === "AL" ? `${race.state} At-Large` : `${race.state}-${String(race.district).replace(/^0+/, "")}`;
  return {
    office: `U.S. House, ${label}`,
    kind: "congress",
    category: "legislative",
    term: "2 years",
    description:
      race.district === "AL"
        ? `${stateName} has one U.S. House seat, so every voter in the state picks this representative.`
        : `Represents one district of ${stateName} in the U.S. House of Representatives.`,
  };
}

// ----- Build the people --------------------------------------------------------

const RESEARCH = new Map(POLITICIANS.map((p) => [p.slug, p]));
const PROFILES = new Map(CANDIDATE_PROFILES.map((p) => [p.slug, p]));

/** Money summary (shares of total receipts) from a FEC totals object. */
function financeView(fec, fecId) {
  if (!fec || !(fec.receipts > 0)) return null;
  const receipts = fec.receipts;
  const candidate = (fec.candidateContrib || 0) + (fec.candidateLoans || 0);
  const parts = [
    { key: "individuals", label: "Individual donors", amount: fec.individuals || 0 },
    { key: "pacs", label: "PACs and other committees", amount: fec.pacs || 0 },
    { key: "party", label: "Party committees", amount: fec.party || 0 },
    { key: "candidate", label: "The candidate (gifts and loans)", amount: candidate },
  ];
  const known = parts.reduce((sum, p) => sum + p.amount, 0);
  const other = Math.max(0, receipts - known);
  if (other > 0) parts.push({ key: "other", label: "Transfers and other", amount: other });
  return {
    cycle: fec.cycle,
    coverageEnd: fec.coverageEnd,
    receipts,
    disbursements: fec.disbursements || 0,
    cashOnHand: fec.cashOnHand || 0,
    debts: fec.debts || 0,
    breakdown: parts
      .filter((p) => p.amount > 0)
      .map((p) => ({ ...p, pct: Math.round((p.amount / receipts) * 1000) / 10 })),
    fecId: fecId || null,
    fecUrl: fecId ? `https://www.fec.gov/data/candidate/${fecId}/` : null,
  };
}

const PEOPLE = new Map(); // slug -> CandidateView
const RACES = new Map(); // race id -> Race
const RACES_BY_STATE = new Map(); // state -> { statewide: Race[], house: Race[] }

function uniqueSlug(base, race) {
  if (!PEOPLE.has(base)) return base;
  const suffix = [race.state.toLowerCase(), race.district && race.district !== "null" ? String(race.district).toLowerCase() : race.office]
    .filter(Boolean)
    .join("-");
  let slug = `${base}-${suffix}`;
  for (let i = 2; PEOPLE.has(slug); i++) slug = `${base}-${suffix}-${i}`;
  return slug;
}

function buildPeople() {
  for (const race of Object.values(NOMINEES)) {
    const text = raceText(race);
    const raceOut = {
      id: race.id,
      office: text.office,
      kind: text.kind,
      category: text.category,
      term: text.term,
      electionDate: race.electionDate,
      status: race.status,
      description: text.description,
      source: "nominees",
      sourceUrl: race.source,
      state: race.state,
      district: race.district,
      candidates: [],
    };

    for (const nom of race.candidates) {
      const base = slugify(nom.name);
      const slug = uniqueSlug(base, race);
      const research = RESEARCH.get(slug);
      const profile = PROFILES.get(slug);
      const news = NEWS_SUMMARIES[slug] || null;

      const incumbent = !!nom.incumbent;
      const roleDefault = incumbent
        ? `${text.office.replace(/, special election$/, "")}, seeking re-election`
        : `Nominee for ${text.office.replace(/, special election$/, "")}`;

      PEOPLE.set(slug, {
        slug,
        name: nom.name,
        role: research?.current_office ?? roleDefault,
        party: normalizeParty(nom.party),
        bio: research?.bio ?? null,
        photo: profile?.photo ?? nom.photo ?? null,
        wikipedia: nom.wikipedia ?? null,
        openSecretsUrl: profile?.openSecretsUrl ?? null,
        status:
          profile?.status ?? {
            statusType: incumbent ? "incumbent" : "running",
            statusLabel: incumbent ? "Incumbent" : "On the 2026 ballot",
            termInfo: `On the Nov. 3, 2026 ballot for ${text.office.replace(/, special election$/, "")}.`,
            currentTitle: "",
            state: STATE_NAMES[race.state] || race.state,
            runningFor: text.office,
            plainEnglish: "",
          },
        career: mergeCareer(research?.career_history ?? [], profile?.career ?? []),
        finance: financeView(nom.fec, nom.fecId),
        opinions: profile?.opinions ?? [],
        sources: profile?.sources ?? [],
        misconceptions: profile?.misconceptions ?? [],
        news,
        researched: !!(research || news || profile),
        onBallot: true,
        raceId: race.id,
        raceOffice: text.office,
        state: race.state,
        incumbent,
      });

      raceOut.candidates.push({ slug, name: nom.name, party: normalizeParty(nom.party), incumbent });
    }

    RACES.set(race.id, raceOut);
    const bucket = RACES_BY_STATE.get(race.state) || { statewide: [], house: [] };
    (race.office === "house" ? bucket.house : bucket.statewide).push(raceOut);
    RACES_BY_STATE.set(race.state, bucket);
  }

  // Researched people who are NOT on the 2026 ballot (e.g. Elizabeth Warren,
  // whose seat is next up in 2030) still get a profile so search can find them.
  for (const profile of PROFILES.values()) {
    if (PEOPLE.has(profile.slug)) continue;
    const research = RESEARCH.get(profile.slug);
    PEOPLE.set(profile.slug, {
      slug: profile.slug,
      name: profile.name,
      role: research?.current_office ?? profile.role,
      party: normalizeParty(profile.party),
      bio: research?.bio ?? null,
      photo: profile.photo ?? null,
      wikipedia: null,
      openSecretsUrl: profile.openSecretsUrl ?? null,
      status: profile.status ?? null,
      career: mergeCareer(research?.career_history ?? [], profile.career ?? []),
      finance: null,
      opinions: profile.opinions ?? [],
      sources: profile.sources ?? [],
      misconceptions: profile.misconceptions ?? [],
      news: NEWS_SUMMARIES[profile.slug] || null,
      researched: true,
      onBallot: false,
      raceId: null,
      raceOffice: null,
      state: "MA",
      incumbent: false,
    });
  }
}

/** Display the same party label for curated and generated records. */
function normalizeParty(party) {
  const value = String(party ?? "").trim();
  return value.toLowerCase() === "democrat" ? "Democratic" : value;
}

// Career merge (ported from lib/candidates.ts in the research app)
const yearsKey = (years) =>
  String(years).replace(/[\u2012-\u2015]/g, "-").replace(/\s+/g, "").toLowerCase();
const startYear = (period) => {
  const m = /\d{4}/.exec(period);
  return m ? Number(m[0]) : 0;
};
function mergeCareer(dbCareer, profileCareer) {
  if (!dbCareer.length) return profileCareer;
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

buildPeople();

// ----- Public API ------------------------------------------------------------------

/** Every candidate profile we have, A to Z by last name. */
export function getCandidates() {
  return [...PEOPLE.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getCandidate(slug) {
  return PEOPLE.get(slug) || null;
}

export function candidateCount() {
  return PEOPLE.size;
}

/**
 * Name / state / office search for the search box. Names that START with the
 * query rank first, then names containing it, then other fields.
 */
export function searchCandidates(query, limit = 4) {
  const q = norm(query).trim();
  if (q.length < 2) return [];
  const scored = [];
  for (const c of PEOPLE.values()) {
    const name = norm(c.name);
    let score = 0;
    if (name.startsWith(q)) score = 4;
    else if (name.split(/\s+/).some((w) => w.startsWith(q))) score = 3;
    else if (name.includes(q)) score = 2;
    else if (norm(`${c.role} ${c.party} ${STATE_NAMES[c.state] || ""}`).includes(q)) score = 1;
    if (score) scored.push({ c, score: score + (c.researched ? 0.5 : 0) });
  }
  scored.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  return scored.slice(0, limit).map((s) => s.c);
}

/** Look up one race by its id ("senate:MA", "governor:OH", "house:MA-05"). */
export function getRace(id) {
  return RACES.get(id) || null;
}

/** Turn a stored race into the Race shape the ballot renders (data/types.js). */
function toBallotRace(race, extra = {}) {
  return {
    id: race.id,
    office: race.office,
    kind: race.kind,
    category: race.category,
    term: race.term,
    electionDate: race.electionDate,
    description: race.description,
    source: "nominees",
    sourceUrl: race.sourceUrl,
    pending: race.status === "pending" || race.candidates.length === 0,
    candidates: race.candidates.map((c) => ({ ...c })),
    ...extra,
  };
}

/**
 * Races to show for a place.
 * @param {string} state  USPS code
 * @param {{congress?: string|null, allHouse?: boolean}} [opts]
 *   congress: the person's House district as "TX-22" / "AK-AL" (from the Census)
 *   allHouse: list every House race in the state (used on a state's own page)
 */
export function racesForPlace(state, opts = {}) {
  const bucket = RACES_BY_STATE.get(state);
  if (!bucket) return [];
  const out = bucket.statewide.map((r) => toBallotRace(r, { scopeName: STATE_NAMES[state] }));

  const house = bucket.house.slice().sort((a, b) => String(a.district).localeCompare(String(b.district), undefined, { numeric: true }));
  if (opts.congress) {
    const [, d] = opts.congress.split("-");
    const district = d === "AL" ? "AL" : String(d).padStart(2, "0");
    const hit = house.find((r) => String(r.district) === district);
    if (hit) out.push(toBallotRace(hit, { scopeName: "Your district" }));
  } else if (opts.allHouse) {
    for (const r of house) out.push(toBallotRace(r, { scopeName: STATE_NAMES[state] }));
  }
  return out;
}

/** How many candidates we list in total (for the front page). */
export function totals() {
  return { ...NOMINEES_META.counts, people: PEOPLE.size };
}
