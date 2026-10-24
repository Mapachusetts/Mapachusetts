// data/races.js
// Factory helpers that build race objects. Keeping the shape in one place makes
// it easy to (a) keep mock data consistent and (b) see the target schema when
// wiring a real civic API.
//
// Race shape:
//   id           - unique-ish id for keys
//   office       - the office/title being contested ("Governor", "Mayor", ...)
//   category     - grouping used for icons/filtering
//                    ("executive" | "legislative" | "local" | "education" | "measure")
//   term         - descriptive term/length (optional)
//   electionDate - "YYYY-MM-DD" of the next election, or null when it varies
//   candidates   - [{ name, party }]  (party optional)
//   description  - optional extra context
//
//   source       - "sample" for placeholders (shows a "Sample" badge); real
//                  races set the outlet/office name and a sourceUrl
//   candidates[].slug - optional; links the name to /candidates/<slug>
//
// ALL CANDIDATES BELOW ARE PLACEHOLDERS ("Candidate A"). Replace with real data
// from a civic API (see data/civic.js). Real races live in data/places.js
// (e.g. the Massachusetts governor and U.S. Senate races).
//
// At render time places.js attaches `scopeName` / `scopeLevel` so the UI can
// show "Decided at: Boston".

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
    source: "sample",
    id: uid("pres"),
    office: "President of the United States",
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
    source: "sample",
    id: uid("gov"),
    office: `Governor of ${stateName}`,
    category: "executive",
    term: "4 years",
    electionDate: MIDTERM_2026,
    candidates: TWO("Candidate C", "Candidate D"),
    description: `Statewide executive race for ${stateName}.`,
  };
}

export function makeSenateRace(stateName) {
  return {
    source: "sample",
    id: uid("sen"),
    office: `U.S. Senator (${stateName})`,
    category: "legislative",
    term: "6 years",
    electionDate: MIDTERM_2026,
    candidates: TWO("Candidate E", "Candidate F"),
    description: `Represents ${stateName} in the U.S. Senate.`,
  };
}

export function makeHouseRace(districtCode) {
  return {
    source: "sample",
    id: uid("house"),
    office: `U.S. House, District ${districtCode}`,
    category: "legislative",
    term: "2 years",
    electionDate: MIDTERM_2026,
    candidates: TWO("Candidate G", "Candidate H"),
    description: `Congressional district ${districtCode}.`,
  };
}

export function makeCountyRace(office, countyName, description) {
  return {
    source: "sample",
    id: uid("county"),
    office,
    category: "local",
    term: "4 years",
    electionDate: MIDTERM_2026,
    candidates: TWO("Candidate N", "Candidate O"),
    description: description || `County-level office for ${countyName}.`,
  };
}

export function makeMayorRace(cityName) {
  return {
    source: "sample",
    id: uid("mayor"),
    office: `Mayor of ${cityName}`,
    category: "local",
    term: "varies",
    electionDate: null,
    candidates: TWO("Candidate I", "Candidate J", "Nonpartisan", "Nonpartisan"),
    description: `Head of the ${cityName} city government. Election dates vary by city.`,
  };
}

// Generic school governing board. `boardName` examples: "Boston School
// Committee", "Fort Bend ISD Board of Trustees".
export function makeSchoolBoardRace(boardName, whatItGoverns) {
  return {
    source: "sample",
    id: uid("school"),
    office: boardName,
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

export function makeBallotMeasure(title, scopeName, summary) {
  return {
    source: "sample",
    id: uid("measure"),
    office: title,
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

// Visual metadata per category: the UI uses this for icons + accent colors.
export const CATEGORY_META = {
  executive: { label: "Executive", icon: "🏛️", color: "#2563eb" },
  legislative: { label: "Legislative", icon: "⚖️", color: "#7c3aed" },
  local: { label: "Local government", icon: "🏙️", color: "#0e7490" },
  education: { label: "Schools", icon: "🎓", color: "#15803d" },
  measure: { label: "Ballot questions", icon: "🗳️", color: "#c2410c" },
};
