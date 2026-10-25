// data/officeholders.js
// Who HOLDS an office right now, whether or not that seat is on the ballot.
//
// Two generated files feed this module (never edit them by hand):
//   data/officeholders.generated.js     President, Vice President, all 100 U.S.
//                                       senators, all 50 governors
//                                       (scripts/export_officeholders.py)
//   data/officeholders.ma.generated.js  Massachusetts only: statewide officers,
//                                       state senators and representatives,
//                                       U.S. representatives, sheriffs, district
//                                       attorneys and mayors
//                                       (scripts/export_ma_officeholders.py)
//
// Only Massachusetts has the smaller seats on purpose. Other states can be
// added the same way: write a generated file with the same shape (see
// "Officeholder" in data/types.js) and add it to SOURCES below.
//
// Each holder says which layer of government it belongs to (`layer` is a key
// of data/kinds.js) and how to find that layer in the Census "stack"
// (`match`), so the UI never needs to geocode anything extra.

import { OFFICEHOLDERS as NATIONAL, OFFICEHOLDERS_META as NATIONAL_META } from "./officeholders.generated.js";
import { OFFICEHOLDERS as MASSACHUSETTS, OFFICEHOLDERS_META as MA_META } from "./officeholders.ma.generated.js";
import { getCandidate, searchCandidates, slugify } from "./candidates.js";

const SOURCES = [
  { meta: NATIONAL_META, holders: NATIONAL },
  { meta: MA_META, holders: MASSACHUSETTS },
];

const ALL = SOURCES.flatMap((s) => s.holders);

/** When the data was written, and what it covers. */
export const OFFICEHOLDER_INFO = {
  asOf: SOURCES.map((s) => s.meta.asOf).sort()[0], // the older of the two
  generatedAt: SOURCES.map((s) => s.meta.generatedAt).sort()[0],
  counts: { national: NATIONAL.length, massachusetts: MASSACHUSETTS.length },
  // States whose smaller offices (legislature, county, city) are listed.
  localStates: ["MA"],
};

// Order within a layer: the person who leads first.
const ORDER = [
  "President of the United States",
  "Vice President of the United States",
  "Governor",
  "Lieutenant Governor",
  "Attorney General",
  "Secretary of the Commonwealth",
  "Treasurer and Receiver-General",
  "State Auditor",
  "U.S. Senator",
];
const rank = (office) => {
  const i = ORDER.indexOf(office);
  return i === -1 ? ORDER.length : i;
};

const byLayer = new Map();
for (const h of ALL) {
  if (!byLayer.has(h.layer)) byLayer.set(h.layer, []);
  byLayer.get(h.layer).push(h);
}

/**
 * Everyone who currently holds an office in the layers of government at a spot.
 *
 * @param {{stateCode: string|null, stack: {id: string, kind: string, geoid?: string, name: string}[]}} where
 * @returns {object[]} holders, each with `kind` (the layer) and `jurisdictionId`
 *                     (the stack entry it belongs to) added, sorted for display.
 */
export function officeholdersForPlace({ stateCode, stack }) {
  const out = [];
  const seen = new Set();
  const add = (h, j) => {
    if (seen.has(h.id)) return;
    seen.add(h.id);
    out.push({ ...h, kind: h.layer, jurisdictionId: j ? j.id : null });
  };

  for (const j of stack) {
    const pool = byLayer.get(j.kind);
    if (!pool) continue;
    for (const h of pool) {
      const m = h.match || {};
      if (j.kind === "country") {
        add(h, j);
      } else if (j.kind === "state") {
        if (stateCode && m.state === stateCode) add(h, j);
      } else if (m.geoid) {
        // Districts, counties and cities are matched on the Census id.
        if (m.geoid === j.geoid && (!m.state || !stateCode || m.state === stateCode)) add(h, j);
      } else if (m.name && m.name === j.name && (!m.state || m.state === stateCode)) {
        add(h, j);
      }
    }
  }
  return out.sort((a, b) => rank(a.office) - rank(b.office) || a.name.localeCompare(b.name));
}

/** Does this state list its smaller offices (legislature, county, city)? */
export function hasLocalOfficeholders(stateCode) {
  return OFFICEHOLDER_INFO.localStates.includes(stateCode);
}

/**
 * The research profile for a holder, when we have one (same person on the 2026
 * ballot or one of the researched profiles). A profile is only linked when the
 * state and last name also agree, so a common name never opens the wrong
 * person.
 * @returns {string|null} candidate slug
 */
export function profileSlugFor(holder) {
  const state = holder.match && holder.match.state;
  if (!state) return null; // President / VP
  const parts = holder.name.split(/\s+/).filter(Boolean);
  const first = slugify(parts[0] || "");
  const last = slugify(parts[parts.length - 1] || "");
  const lastOf = (c) => slugify(c.name.split(/\s+/).pop() || "");

  // 1. The same name, exactly (or without a middle name).
  for (const slug of [slugify(holder.name), slugify(`${parts[0]} ${parts[parts.length - 1]}`)]) {
    const c = getCandidate(slug);
    if (c && c.state === state && lastOf(c) === last) return slug;
  }
  // 2. A nickname ("Ed" / "Edward"): same state, last name, first initial and
  //    party, and only if exactly one person fits.
  const initial = (str) => String(str || "").trim().charAt(0).toLowerCase();
  const fits = searchCandidates(parts[parts.length - 1], 25).filter(
    (c) =>
      c.state === state &&
      lastOf(c) === last &&
      initial(c.name) === first.charAt(0) &&
      initial(c.party) === initial(holder.party)
  );
  return fits.length === 1 ? fits[0].slug : null;
}
