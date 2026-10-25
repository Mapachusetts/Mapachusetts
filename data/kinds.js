// data/kinds.js
// The "layers of government" a U.S. location belongs to, and how each one looks
// and is explained in the UI. Add a kind here (and a way to look it up in
// data/census.js or data/local-sources.js) and it shows up automatically in the
// layer dock, the Layers tab and as a colored boundary on the globe.
//
// COLORS: deliberately NOT red/blue, to avoid reading as party colors.
//   color - bright version, used on the dark map and the dock
//   ink   - darker version, used for text/borders on white cards
//
// `icon` is a key into js/icons.js (the custom icon set); it matches the kind's
// own key so the UI can simply ask for icon(kind).
//
// `blurb` is generic civics education (what this kind of office/district does),
// not claims about a specific place, so it is safe for every location.

export const KINDS = {
  country: {
    label: "Country",
    tag: "Nation",
    icon: "country",
    color: "#38bdf8",
    ink: "#0369a1",
    blurb:
      "The federal government. Voters choose the President every four years, plus members of Congress. Federal law covers things like immigration, national defense, Social Security and the federal budget.",
  },
  state: {
    label: "State",
    tag: "State",
    icon: "state",
    color: "#818cf8",
    ink: "#4338ca",
    blurb:
      "Your state government sets many of the rules that touch daily life: schools, health care, taxes, roads, courts and how elections run. Voters choose a governor, state lawmakers and, in most states, other statewide officials.",
  },
  congress: {
    label: "U.S. House district",
    tag: "Congress",
    icon: "congress",
    color: "#f472b6",
    ink: "#be185d",
    blurb:
      "Each U.S. House district elects one member of the U.S. House of Representatives, who votes on federal laws and spending. Maps are redrawn by states, and some states have changed them recently.",
  },
  senate: {
    label: "State senate district",
    tag: "State Senate",
    icon: "senate",
    color: "#fb923c",
    ink: "#c2410c",
    blurb:
      "Each state senate district elects a member of the upper chamber of the state legislature, which writes state laws and approves the state budget.",
  },
  house: {
    label: "State house district",
    tag: "State House",
    icon: "house",
    color: "#fbbf24",
    ink: "#b45309",
    blurb:
      "Each state house district elects a member of the lower chamber of the state legislature (called the House, Assembly or House of Delegates depending on the state). These districts are smaller than senate districts, so your vote counts for more locally.",
  },
  county: {
    label: "County",
    tag: "County",
    icon: "county",
    color: "#2dd4bf",
    ink: "#0f766e",
    blurb:
      "County government often runs courts, jails, public health, elections, property records and county roads. Depending on the state, voters choose commissioners, a sheriff, a clerk, a judge and more.",
  },
  city: {
    label: "City or town",
    tag: "City / Town",
    icon: "city",
    color: "#4ade80",
    ink: "#15803d",
    blurb:
      "Your city or town government handles local police and fire, zoning, parks, local roads and often water and trash. Voters usually choose a mayor and a city or town council.",
  },
  school: {
    label: "School district",
    tag: "Schools",
    icon: "school",
    color: "#a3e635",
    ink: "#4d7c0f",
    blurb:
      "Runs the public schools and sets the school budget. Voters usually choose the school board. A district can cover several towns, or only part of a big city.",
  },
  ward: {
    label: "City council district",
    tag: "Ward / District",
    icon: "ward",
    color: "#c084fc",
    ink: "#7e22ce",
    blurb:
      "A neighborhood-sized slice of a city, used to elect a city council member. Boundaries are set by the city. Only some cities elect their council this way; others elect everyone citywide.",
  },
  precinct: {
    label: "Voting precinct",
    tag: "Precinct",
    icon: "precinct",
    color: "#94a3b8",
    ink: "#475569",
    blurb:
      "The smallest unit of election administration: neighbors in a precinct usually vote at the same polling place. Some cities group precincts into numbered wards. These lines come from the 2020 Census and change often, so confirm your polling place with your local election office.",
  },
};

// Broad -> local. Used to sort the stack.
export const KIND_ORDER = [
  "country",
  "state",
  "congress",
  "senate",
  "house",
  "county",
  "city",
  "school",
  "ward",
  "precinct",
];

export function kindMeta(kind) {
  return (
    KINDS[kind] || {
      label: kind,
      tag: kind,
      icon: "pin",
      color: "#94a3b8",
      ink: "#475569",
      blurb: "",
    }
  );
}

// Which kinds make sense to show for a place at a given level. A state or
// county page shows only the chain above it; a city page shows everything,
// because districts (Congress, legislature, schools, wards) vary by location.
export function kindsForLevel(level) {
  switch (level) {
    case "country":
      return ["country"];
    case "state":
      return ["country", "state"];
    case "county":
      return ["country", "state", "county"];
    case "city":
    case "district":
      return KIND_ORDER;
    default:
      return [];
  }
}
