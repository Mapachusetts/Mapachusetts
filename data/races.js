// data/races.js
// Shared constants for races: election dates and the category tags.
//
// Race shape (full reference in data/types.js):
//   id           unique id, e.g. "senate:MA", "governor:OH", "house:MA-05"
//   office       "U.S. Senator (Massachusetts)", "Governor of Ohio", ...
//   kind         WHICH LAYER OF GOVERNMENT decides it: a key of KINDS in
//                data/kinds.js. The ballot tab groups races by this.
//   category     "executive" | "legislative" | "local" | "education" | "measure"
//                (small tag on each card; see CATEGORY_META below)
//   term         "6 years"
//   electionDate "YYYY-MM-DD"
//   candidates   [{ slug, name, party, incumbent }]
//
// Races are built from real nominee data in data/candidates.js. This file used
// to hold placeholder race factories ("Candidate A"); they were removed so
// nothing invented can reach the page.

export const GENERAL_ELECTION_2026 = "2026-11-03"; // Tuesday, Nov 3, 2026
export const GENERAL_ELECTION_2028 = "2028-11-07"; // Tuesday, Nov 7, 2028

// Back-compat names used by the countdown in js/ui.js.
export const MIDTERM_2026 = GENERAL_ELECTION_2026;
export const PRESIDENTIAL_2028 = GENERAL_ELECTION_2028;

// Small tag on each race card. `icon` is a key into js/icons.js.
export const CATEGORY_META = {
  executive: { label: "Executive", icon: "executive", color: "#2563eb" },
  legislative: { label: "Legislative", icon: "legislative", color: "#7c3aed" },
  local: { label: "Local government", icon: "local", color: "#0e7490" },
  education: { label: "Schools", icon: "education", color: "#15803d" },
  measure: { label: "Ballot question", icon: "measure", color: "#c2410c" },
};
