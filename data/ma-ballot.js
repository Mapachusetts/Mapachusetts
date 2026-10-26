// data/ma-ballot.js
// Massachusetts pilot: everything else on a voter's Nov. 3, 2026 ballot, matched
// to the layers of government that cover a spot.
//
//   massachusettsRacesFor(stack, {atState})   races below U.S. House: statewide
//                                             offices, Governor's Council, State
//                                             Senate and House, county offices
//   massachusettsQuestionsFor(stack)          the nine statewide ballot questions
//                                             plus any district-only questions
//
// Data comes from three files (see the header of each for sources and how they
// were checked):
//   data/ma-ballot.generated.js   candidates (scripts/export_ma_ballot.py)
//   data/ma-ballot-questions.js   ballot questions (curated by hand)
//   data/ma-voting-notices.js     voting changes (used by js/voting-info.js)

import { massachusettsRaces, MA_BALLOT_META } from "./candidates.js";
import { MA_QUESTIONS, MA_QUESTIONS_META } from "./ma-ballot-questions.js";

export { MA_BALLOT_META, MA_QUESTIONS_META };

const RACES = massachusettsRaces();

/** Is the scope satisfied by what covers this spot? */
function inScope(scope, stack) {
  const has = (kind, geoid) => stack.some((j) => j.kind === kind && j.geoid === geoid);
  if (scope.state) return true;
  if (scope.countyGeoid) return has("county", scope.countyGeoid);
  if (scope.townGeoids) {
    // Governor's Council: its districts are whole State Senate districts, which
    // is exact even for towns split between districts (Boston, Cambridge, Braintree).
    if (scope.senateGeoids && stack.some((j) => j.kind === "senate")) {
      return stack.some((j) => j.kind === "senate" && scope.senateGeoids.includes(j.geoid));
    }
    const city = stack.find((j) => j.kind === "city");
    if (!city) return false;
    const split = scope.splitTownGeoids || [];
    return scope.townGeoids.includes(city.geoid) && !split.includes(city.geoid);
  }
  // A single state senate / house district: the race's kind says which.
  return null;
}

/**
 * Races for a spot. On a state's own page only the statewide offices are listed;
 * the rest need an exact place (an address, ZIP or location) so we know your
 * districts.
 * @param {{id: string, kind: string, geoid?: string}[]} stack
 * @param {{atState?: boolean}} [opts]
 */
export function massachusettsRacesFor(stack, { atState = false } = {}) {
  const out = [];
  for (const r of RACES) {
    const sc = r.scope;
    let show;
    if (sc.state) show = true;
    else if (atState) show = false;
    else if (sc.geoid) show = stack.some((j) => j.kind === r.kind && j.geoid === sc.geoid);
    else show = !!inScope(sc, stack);
    if (show) out.push({ ...r, candidates: r.candidates.map((c) => ({ ...c })) });
  }
  return out;
}

/** The order races read in on the ballot within the State layer. */
const STATE_ORDER = [
  "Lieutenant Governor",
  "Attorney General",
  "Secretary of the Commonwealth",
  "Treasurer and Receiver-General",
  "State Auditor",
  "Governor's Council",
];
export function sortStateRaces(races) {
  const rank = (r) => {
    const i = STATE_ORDER.findIndex((o) => r.office.startsWith(o));
    return i === -1 ? STATE_ORDER.length : i;
  };
  return races.slice().sort((a, b) => rank(a) - rank(b));
}

/**
 * Ballot questions for a spot: the statewide ones always, plus district-only
 * ones when the spot is inside that district.
 * @returns {object[]} each with `kind` ("state" or the district layer) added
 */
export function massachusettsQuestionsFor(stack) {
  const out = [];
  for (const q of MA_QUESTIONS) {
    const sc = q.scope || {};
    if (sc.state) {
      out.push({ ...q, kind: "state" });
    } else if (sc.geoid && stack.some((j) => j.kind === "house" && j.geoid === sc.geoid)) {
      out.push({ ...q, kind: "house" });
    } else if (sc.geoid && stack.some((j) => j.kind === "senate" && j.geoid === sc.geoid)) {
      out.push({ ...q, kind: "senate" });
    } else if (sc.townGeoids && stack.some((j) => j.kind === "city" && sc.townGeoids.includes(j.geoid))) {
      out.push({ ...q, kind: "city" });
    }
  }
  return out;
}
