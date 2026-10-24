// data/races.js
// Factory helpers that build race objects. Keeping the shape in one place makes
// it easy to (a) keep sample data consistent and (b) see the target schema when
// wiring a real data source.
//
// Race shape (full reference in data/types.js):
//   id           unique-ish id for keys
//   office       the office being contested ("Governor of Texas", ...)
//   kind         WHICH LAYER OF GOVERNMENT decides it: a key of KINDS in
//                data/kinds.js ("country" | "state" | "congress" | "senate" |
//                "house" | "county" | "city" | "school" | "ward"). The ballot
//                tab groups races by this.
//   category     secondary grouping/icon: "executive" | "legislative" | "local" |
//                "education" | "measure"
//   term         "4 years" (optional)
//   electionDate "YYYY-MM-DD" of the next election, or null when it varies
//   candidates   [{ name, party }]
//   description  optional plain-language context
//
// ALL CANDIDATES BELOW ARE PLACEHOLDERS ("Candidate A"). Replace with real data
// from your data source (see data/civic.js).

export const MIDTERM_2026 = "2026-11-03"; // General Election Day, Nov 3 2026
export const PRESIDENTIAL_2028 = "2028-11-07"; // General Election Day, Nov 7 2028

let _seq = 0;
const uid = (prefix) => `${prefix}-${++_seq}`;

const TWO = (a, b, partyA = "Party 1", partyB = "Party 2") => [
  { name: a, party: partyA },
  { name: b, party: partyB },
];

export function presidentialRace() {
  return {
    id: uid("pres"),
    office: "President of the United States",
    kind: "country",
    category: "executive",
    term: "4 years",
    electionDate: PRESIDENTIAL_2028,
    candidates: TWO("Candidate A", "Candidate B"),
    description:
      "National election, next held in 2028. Applies to every U.S. location.",
  };
}

export function makeGovernorRace(stateName) {
  return {
    id: uid("gov"),
    office: `Governor of ${stateName}`,
    kind: "state",
    category: "executive",
    term: "4 years",
    electionDate: MIDTERM_2026,
    candidates: TWO("Candidate C", "Candidate D"),
    description: `Statewide executive race for ${stateName}.`,
  };
}

export function makeSenateRace(stateName) {
  return {
    id: uid("sen"),
    office: `U.S. Senator (${stateName})`,
    kind: "state",
    category: "legislative",
    term: "6 years",
    electionDate: MIDTERM_2026,
    candidates: TWO("Candidate E", "Candidate F"),
    description: `Represents all of ${stateName} in the U.S. Senate.`,
  };
}

// One race per U.S. House district. `districtCode` like "TX-22".
export function makeHouseRace(districtCode) {
  return {
    id: uid("house"),
    office: `U.S. House, District ${districtCode}`,
    kind: "congress",
    category: "legislative",
    term: "2 years",
    electionDate: MIDTERM_2026,
    candidates: TWO("Candidate G", "Candidate H"),
    description: `Represents congressional district ${districtCode} in Washington, D.C.`,
  };
}

// State legislature: `chamber` is "senate" or "house"; `districtName` is the
// district's name from the Census ("State Senate District 17").
export function makeStateLegislatorRace(chamber, districtName, stateName) {
  const upper = chamber === "senate";
  return {
    id: uid(upper ? "ssen" : "shouse"),
    office: `${upper ? "State Senator" : "State Representative"}, ${districtName}`,
    kind: chamber,
    category: "legislative",
    term: "varies by state",
    electionDate: null,
    candidates: TWO("Candidate P", "Candidate Q"),
    description: `Represents this district in the ${stateName} ${
      upper ? "Senate" : "House (lower chamber)"
    }. Terms and election years vary by state.`,
  };
}

export function makeCountyRace(office, countyName, description) {
  return {
    id: uid("county"),
    office,
    kind: "county",
    category: "local",
    term: "4 years",
    electionDate: MIDTERM_2026,
    candidates: TWO("Candidate N", "Candidate O"),
    description: description || `County-level office for ${countyName}.`,
  };
}

export function makeMayorRace(cityName) {
  return {
    id: uid("mayor"),
    office: `Mayor of ${cityName}`,
    kind: "city",
    category: "local",
    term: "varies",
    electionDate: null,
    candidates: TWO("Candidate I", "Candidate J", "Nonpartisan", "Nonpartisan"),
    description: `Head of the ${cityName} city government. Election dates vary by city.`,
  };
}

// School governing board. `boardName` examples: "Boston School Committee",
// "Fort Bend ISD Board of Trustees".
export function makeSchoolBoardRace(boardName, whatItGoverns) {
  return {
    id: uid("school"),
    office: boardName,
    kind: "school",
    category: "education",
    term: "varies",
    electionDate: null,
    candidates: [
      { name: "Candidate K", party: "Nonpartisan" },
      { name: "Candidate L", party: "Nonpartisan" },
      { name: "Candidate M", party: "Nonpartisan" },
    ],
    description: `Governs ${whatItGoverns || "the local public schools"}.`,
  };
}

// `kind` = the layer that votes on it (default "state").
export function makeBallotMeasure(title, scopeName, summary, kind = "state") {
  return {
    id: uid("measure"),
    office: title,
    kind,
    category: "measure",
    term: null,
    electionDate: MIDTERM_2026,
    candidates: [
      { name: "Yes", party: null },
      { name: "No", party: null },
    ],
    description: `${summary} (${scopeName}).`,
  };
}

// Visual metadata per category: used for the small tag on each race card.
export const CATEGORY_META = {
  executive: { label: "Executive", icon: "🏛️", color: "#2563eb" },
  legislative: { label: "Legislative", icon: "⚖️", color: "#7c3aed" },
  local: { label: "Local government", icon: "🏙️", color: "#0e7490" },
  education: { label: "Schools", icon: "🎓", color: "#15803d" },
  measure: { label: "Ballot question", icon: "🗳️", color: "#c2410c" },
};
