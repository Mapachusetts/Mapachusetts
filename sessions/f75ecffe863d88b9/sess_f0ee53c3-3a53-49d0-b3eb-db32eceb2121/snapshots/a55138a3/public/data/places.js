// data/places.js
// The place hierarchy the user drills through, as a tree of nodes.
//
// Node shape:
//   id        - unique string id
//   name      - display name
//   level     - one of the LEVELS keys (data/levels.js)
//   center    - [lng, lat] the camera flies to
//   zoom      - optional camera zoom override (else the level's default)
//   extent    - optional [west, south, east, north]; when present the camera
//               frames this box (used for places found via search)
//   bbox      - optional [west, south, east, north] used ONLY as an offline
//               fallback to match raw GPS coordinates (see resolveByCoords)
//   aliases   - optional extra names that should match this node when searching
//   code      - optional code ("US" for the country, USPS code for states)
//   races     - races DECIDED at this node (see data/races.js)
//   events    - events that apply to this node and everything below it
//   children  - child nodes (next level down)
//   parent    - set automatically; the node one level up
//   dynamic   - true when the node was created at runtime from a search
//
// SCOPE: United States only. Tree = World -> United States -> 50 states + DC ->
// counties -> cities -> districts. See data/types.js for the exact shapes.
//
// HOW TO EXTEND
//   - Add a county/city by nesting a node under the right parent (see the
//     curated section below the state list).
//   - Anything not listed here still works: searching for it creates the node
//     on the fly (ensurePath) with no races/events until you add some.
//   - Races and events are INHERITED downward: a state's governor race shows
//     up for every city inside that state.
//
// All races, candidates and events here are SAMPLE data. See data/civic.js for
// the seam to plug in a real source.

import { LEVEL_INDEX } from "./levels.js";
import { US_STATES, STATE_ZOOM } from "./us-states.js";
import {
  MIDTERM_2026,
  presidentialRace,
  makeGovernorRace,
  makeSenateRace,
  makeHouseRace,
  makeCountyRace,
  makeMayorRace,
  makeSchoolBoardRace,
  makeBallotMeasure,
} from "./races.js";
import { makeEvent, electionDayEvent, daysFromNow } from "./events.js";

// ----- Building blocks -----------------------------------------------------

function node(fields) {
  return { races: [], events: [], children: [], ...fields };
}

// ----- United States (the only country for now) -----------------------------

const usa = node({
  id: "usa",
  name: "United States",
  level: "country",
  code: "US",
  aliases: ["usa", "united states of america", "us", "america"],
  center: [-98.5, 39.8],
  zoom: 3.4,
  races: [presidentialRace()],
  events: [electionDayEvent("2026-11-03", "United States")],
  children: US_STATES.map(([code, name, lng, lat]) =>
    node({
      id: `us-${code.toLowerCase()}`,
      name,
      level: "state",
      code,
      center: [lng, lat],
      zoom: STATE_ZOOM[code],
    })
  ),
});

// The root of the tree. The "Whole world" view looks at the Americas first,
// then spins gently.
export const PLACES = node({
  id: "globe",
  name: "Earth",
  level: "globe",
  center: [-98, 30],
  children: [usa],
});

// ----- Curated data --------------------------------------------------------
// These are the places with sample races + events. Everything else gets the
// "no local data yet" empty state until someone adds it here (or a real API).

function stateNode(code) {
  return usa.children.find((s) => s.code === code);
}

// ===== Massachusetts =====
// The governor and U.S. Senate races are REAL (Nov 3, 2026 general election
// ballot). Candidates with a `slug` link to their research profile at
// /candidates/<slug> (the Next.js candidate pages, data from Supabase).
const MA_BALLOT_SOURCE = {
  source: "GBH News voter guide",
  sourceUrl:
    "https://www.wgbh.org/news/politics/2026-10-22/mass-midterm-election-2026-everything-you-need-to-know",
};

Object.assign(stateNode("MA"), {
  bbox: [-73.5, 41.2, -69.9, 42.9],
  races: [
    {
      id: "ma-governor-2026",
      office: "Governor of Massachusetts",
      category: "executive",
      term: "4 years",
      electionDate: MIDTERM_2026,
      candidates: [
        { name: "Maura Healey", party: "Democratic", slug: "maura-healey" },
        { name: "Mike Minogue", party: "Republican", slug: "mike-minogue" },
        { name: "Andrea James", party: "Independent" },
      ],
      description:
        "Governor and lieutenant governor run together on one ticket: Healey and Kim Driscoll (D), Minogue and Shawn Oliver (R), James and Kayla Kittredge (I). Oliver suspended his campaign but remains on the ballot.",
      ...MA_BALLOT_SOURCE,
    },
    {
      id: "ma-us-senate-2026",
      office: "U.S. Senator (Massachusetts)",
      category: "legislative",
      term: "6 years",
      electionDate: MIDTERM_2026,
      candidates: [
        { name: "Ed Markey", party: "Democratic", slug: "ed-markey" },
        { name: "John Deaton", party: "Republican", slug: "john-deaton" },
        { name: "Shiva Ayyadurai", party: "Independent" },
        { name: "Joe Tache", party: "Party for Socialism and Liberation" },
      ],
      description:
        "Represents Massachusetts in the U.S. Senate. Sen. Elizabeth Warren's seat isn't on the ballot again until 2030.",
      ...MA_BALLOT_SOURCE,
    },
    makeBallotMeasure(
      "Sample Ballot Question 1",
      "Massachusetts",
      "Placeholder statewide question"
    ),
  ],
  events: [
    makeEvent({
      title: "Statewide Candidate Forum: Governor",
      type: "debate",
      start: daysFromNow(6, 19, 0),
      venue: "Streamed online",
      virtual: true,
      description:
        "Hear the candidates for governor answer questions on housing, transportation and schools.",
    }),
  ],
  children: [
    node({
      id: "ma-suffolk",
      name: "Suffolk County",
      level: "county",
      center: [-71.07, 42.33],
      zoom: 10,
      bbox: [-71.19, 42.22, -70.92, 42.45],
      children: [
        node({
          id: "ma-boston",
          name: "Boston",
          level: "city",
          center: [-71.0589, 42.3601],
          zoom: 11.5,
          bbox: [-71.19, 42.23, -70.98, 42.4],
          races: [
            makeHouseRace("MA-07"),
            makeMayorRace("Boston"),
            makeSchoolBoardRace(
              "Boston School Committee",
              "the Boston Public Schools"
            ),
            makeBallotMeasure(
              "Sample City Question A",
              "Boston",
              "Placeholder question about funding for public transit"
            ),
          ],
          events: [
            makeEvent({
              title: "City Council Public Hearing",
              type: "hearing",
              start: daysFromNow(4, 18, 0),
              venue: "Boston City Hall, Council Chamber",
              description:
                "Residents can speak for up to three minutes on items on the agenda.",
            }),
            makeEvent({
              title: "Neighborhood Budget Town Hall",
              type: "townhall",
              start: daysFromNow(11, 18, 30),
              venue: "Local library, community room",
              virtual: true,
              description:
                "Ask city officials how neighborhood budget money is being spent.",
            }),
          ],
        }),
        node({
          id: "ma-chelsea",
          name: "Chelsea",
          level: "city",
          center: [-71.0328, 42.3918],
          zoom: 13,
          bbox: [-71.06, 42.37, -71.0, 42.41],
          races: [
            makeHouseRace("MA-07"),
            makeMayorRace("Chelsea"),
            makeSchoolBoardRace("Chelsea School Committee", "the Chelsea public schools"),
          ],
        }),
      ],
    }),
    node({
      id: "ma-middlesex",
      name: "Middlesex County",
      level: "county",
      center: [-71.39, 42.48],
      zoom: 9,
      bbox: [-71.9, 42.15, -71.0, 42.73],
      children: [
        node({
          id: "ma-medford",
          name: "Medford",
          level: "city",
          center: [-71.1062, 42.4184],
          zoom: 12.3,
          bbox: [-71.15, 42.395, -71.07, 42.455],
          races: [
            makeHouseRace("MA-05"),
            makeMayorRace("Medford"),
            makeSchoolBoardRace("Medford School Committee", "the Medford Public Schools"),
          ],
          events: [
            makeEvent({
              title: "City Council Meeting",
              type: "meeting",
              start: daysFromNow(3, 19, 0),
              venue: "Medford City Hall, Council Chamber",
              description:
                "Regular meeting. The agenda is posted a few days before on the city website.",
            }),
            makeEvent({
              title: "Mayor's Community Town Hall",
              type: "townhall",
              start: daysFromNow(8, 18, 30),
              venue: "Medford Public Library",
              virtual: true,
              description:
                "Open Q&A with the mayor about city services, zoning and the budget.",
            }),
            makeEvent({
              title: "School Committee Meeting",
              type: "meeting",
              start: daysFromNow(10, 18, 30),
              venue: "Medford High School, Library",
              description: "Public comment is open at the start of the meeting.",
            }),
            makeEvent({
              title: "Candidate Forum: U.S. House, District MA-05",
              type: "debate",
              start: daysFromNow(14, 19, 0),
              venue: "Streamed online",
              virtual: true,
              description: "Moderated forum with candidates for Congress.",
            }),
          ],
        }),
        node({
          id: "ma-cambridge",
          name: "Cambridge",
          level: "city",
          center: [-71.1097, 42.3736],
          zoom: 12,
          bbox: [-71.16, 42.35, -71.06, 42.41],
          races: [
            makeHouseRace("MA-07"),
            makeMayorRace("Cambridge"),
            makeSchoolBoardRace("Cambridge School Committee", "the Cambridge public schools"),
          ],
          events: [
            makeEvent({
              title: "City Council Meeting",
              type: "meeting",
              start: daysFromNow(5, 17, 30),
              venue: "Cambridge City Hall",
              description: "Regular weekly-style meeting with public comment.",
            }),
          ],
        }),
      ],
    }),
  ],
});

// ===== Texas =====
Object.assign(stateNode("TX"), {
  bbox: [-106.7, 25.8, -93.5, 36.6],
  races: [makeGovernorRace("Texas"), makeSenateRace("Texas")],
  events: [
    makeEvent({
      title: "Statewide Candidate Forum: Governor",
      type: "debate",
      start: daysFromNow(5, 19, 0),
      venue: "Streamed online",
      virtual: true,
      description:
        "Candidates for governor take questions on the economy, schools and infrastructure.",
    }),
  ],
  children: [
    node({
      id: "tx-fortbend",
      name: "Fort Bend County",
      level: "county",
      center: [-95.77, 29.53],
      zoom: 9.3,
      bbox: [-96.0, 29.35, -95.45, 29.78],
      races: [
        makeCountyRace(
          "Fort Bend County Judge",
          "Fort Bend County",
          "Leads the county's Commissioners Court."
        ),
      ],
      events: [
        makeEvent({
          title: "Commissioners Court Meeting",
          type: "meeting",
          start: daysFromNow(8, 9, 0),
          venue: "Commissioners Courtroom, Richmond",
          description:
            "The county's governing body votes on budgets, roads and drainage projects.",
        }),
      ],
      children: [
        node({
          id: "tx-sugarland",
          name: "Sugar Land",
          level: "city",
          center: [-95.6349, 29.6197],
          zoom: 11.6,
          bbox: [-95.7, 29.51, -95.58, 29.66],
          races: [
            makeHouseRace("TX-22"),
            makeMayorRace("Sugar Land"),
            makeSchoolBoardRace(
              "Fort Bend ISD Board of Trustees",
              "the Fort Bend Independent School District"
            ),
          ],
          events: [
            makeEvent({
              title: "City Council Regular Meeting",
              type: "meeting",
              start: daysFromNow(6, 19, 0),
              venue: "Sugar Land City Hall, Council Chamber",
              description:
                "Regular meeting with a public comment period. Agenda posted on the city website.",
            }),
            makeEvent({
              title: "Community Town Hall: Growth, Traffic and Drainage",
              type: "townhall",
              start: daysFromNow(9, 18, 30),
              venue: "Sugar Land City Hall, with an online option",
              virtual: true,
              description:
                "City staff and council members answer resident questions about development and flood control.",
            }),
            makeEvent({
              title: "Fort Bend ISD Board of Trustees Meeting",
              type: "meeting",
              start: daysFromNow(12, 18, 0),
              venue: "Fort Bend ISD Administration Building",
              description: "Open session with public comment on school district business.",
            }),
            makeEvent({
              title: "Candidate Forum: U.S. House, District TX-22",
              type: "debate",
              start: daysFromNow(15, 19, 0),
              venue: "Streamed online",
              virtual: true,
              description: "Moderated forum with candidates for Congress.",
            }),
          ],
        }),
      ],
    }),
  ],
});

// ===== New York =====
Object.assign(stateNode("NY"), {
  bbox: [-79.8, 40.5, -71.8, 45],
  races: [makeGovernorRace("New York")],
  children: [
    node({
      id: "ny-nyc",
      name: "New York City",
      level: "city",
      aliases: ["new york", "city of new york", "nyc"],
      center: [-74.006, 40.7128],
      zoom: 10,
      bbox: [-74.26, 40.49, -73.7, 40.92],
      races: [
        makeMayorRace("New York City"),
        makeSchoolBoardRace("NYC Panel for Educational Policy", "the New York City public schools"),
      ],
    }),
  ],
});

// ===== California =====
Object.assign(stateNode("CA"), {
  bbox: [-124.5, 32.5, -114, 42],
  races: [makeGovernorRace("California")],
  children: [
    node({
      id: "ca-sf",
      name: "San Francisco County",
      level: "county",
      center: [-122.44, 37.76],
      zoom: 11,
      bbox: [-122.52, 37.7, -122.35, 37.83],
      children: [
        node({
          id: "ca-sfcity",
          name: "San Francisco",
          level: "city",
          center: [-122.4194, 37.7749],
          zoom: 11.5,
          bbox: [-122.52, 37.7, -122.35, 37.83],
          races: [
            makeHouseRace("CA-11"),
            makeMayorRace("San Francisco"),
            makeSchoolBoardRace("San Francisco Board of Education", "San Francisco's public schools"),
          ],
        }),
      ],
    }),
  ],
});

// ----- Index + parent links -------------------------------------------------

const INDEX = new Map();

function register(n, parent = null) {
  n.parent = parent;
  INDEX.set(n.id, n);
  for (const child of n.children) register(child, n);
}
register(PLACES);

// ----- Lookup helpers -------------------------------------------------------

export function findNodeById(id) {
  return INDEX.get(id) || null;
}

// Chain of nodes from the root (Earth) down to and including the node. Used for
// breadcrumbs. Empty array if the id is unknown.
export function pathToNode(id) {
  let n = INDEX.get(id);
  const path = [];
  while (n) {
    path.unshift(n);
    n = n.parent;
  }
  return path;
}

// Fallback used only when reverse geocoding is unavailable: given a [lng, lat]
// find the deepest curated node whose bbox contains the point.
export function resolveByCoords(lng, lat, n = PLACES, trail = []) {
  const nextTrail = [...trail, n];
  for (const child of n.children) {
    if (bboxContains(child.bbox, lng, lat)) {
      return resolveByCoords(lng, lat, child, nextTrail);
    }
  }
  return nextTrail;
}

function bboxContains(bbox, lng, lat) {
  if (!bbox) return false;
  const [w, s, e, n] = bbox;
  return lng >= w && lng <= e && lat >= s && lat <= n;
}

// Every race that applies to a node: its own plus those inherited from every
// ancestor (state governor applies to each city in the state, etc.).
export function racesForNode(id) {
  const out = [];
  for (const n of pathToNode(id)) {
    for (const race of n.races) {
      out.push({ ...race, scopeName: n.name, scopeLevel: n.level });
    }
  }
  return out;
}

// Upcoming events that apply to a node (own + inherited), soonest first.
export function eventsForNode(id, now = new Date()) {
  const out = [];
  for (const n of pathToNode(id)) {
    for (const evt of n.events) {
      const endsAt = evt.end
        ? new Date(evt.end)
        : new Date(new Date(evt.start).getTime() + 3 * 3600 * 1000);
      if (endsAt < now) continue; // already over
      out.push({ ...evt, scopeName: n.name, scopeLevel: n.level });
    }
  }
  out.sort((a, b) => new Date(a.start) - new Date(b.start));
  return out;
}

// For the dropdowns: given the current path and a level, return the choices
// available at that level and which one (if any) is currently selected.
export function optionsForLevel(path, levelKey) {
  const idx = LEVEL_INDEX[levelKey];
  let parent = PLACES;
  for (const n of path) {
    if (LEVEL_INDEX[n.level] < idx) parent = n;
  }
  // Single-country build: the State menu always lists U.S. states, even from
  // the whole-world view, so people can skip straight to their state.
  if (levelKey === "state" && parent === PLACES) parent = usa;
  const options = parent.children
    .filter((c) => c.level === levelKey)
    .sort((a, b) => a.name.localeCompare(b.name));
  const selected = path.find((n) => n.level === levelKey) || null;
  return { parent, options, selected };
}

// ----- Dynamic nodes (search results) --------------------------------------

// Lowercase, strip accents and generic suffixes so "Fort Bend County",
// "Fort Bend" and "fort bend" all compare equal.
export function normalizeName(str) {
  return String(str || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\b(county|parish|borough|city of|town of|municipality of)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function nameMatches(n, normalized) {
  if (normalizeName(n.name) === normalized) return true;
  return (n.aliases || []).some((a) => normalizeName(a) === normalized);
}

function findChild(parent, name, level, code) {
  const target = normalizeName(name);
  return (
    parent.children.find(
      (c) =>
        c.level === level &&
        ((code && c.code && c.code.toUpperCase() === code.toUpperCase()) ||
          nameMatches(c, target))
    ) || null
  );
}

// Search the whole subtree (used when a result skips the county level but we
// already have that city filed under a county).
function findInSubtree(root, name, level) {
  const target = normalizeName(name);
  const stack = [...root.children];
  while (stack.length) {
    const n = stack.pop();
    if (n.level === level && nameMatches(n, target)) return n;
    stack.push(...n.children);
  }
  return null;
}

function slugify(str) {
  return normalizeName(str).replace(/ /g, "-") || "unknown";
}

function addDynamicChild(parent, fields) {
  const child = node({
    id: `${parent.id}/${slugify(fields.name)}`,
    dynamic: true,
    ...fields,
  });
  child.parent = parent;
  parent.children.push(child);
  INDEX.set(child.id, child);
  return child;
}

// Show "Fort Bend County" rather than "Fort Bend" for U.S. counties.
function countyDisplayName(name, countryCode) {
  if (countryCode === "US" && !/\b(county|parish|borough|census area)\b/i.test(name)) {
    return `${name} County`;
  }
  return name;
}

/**
 * Turn a geocoder result into a path of place nodes, creating any county /
 * city / district nodes that don't exist yet. Returns the path from Earth down
 * to the deepest place we could identify (always at least [Earth]).
 *
 * United States only: results from other countries return just [Earth].
 * All 50 states + DC always exist (data/us-states.js), so only counties,
 * cities and districts are ever created at runtime.
 *
 * @param {object} desc - normalized geocoder result (see js/geocode.js):
 *   { type, name, country, countryCode, state, county, city, lng, lat, extent }
 */
export function ensurePath(desc) {
  const path = [PLACES];
  if (desc.countryCode !== "US") return path;

  const here = [desc.lng, desc.lat];
  const isType = (t) => desc.type === t;
  path.push(usa);

  // State (always pre-built; never created at runtime)
  const stateName = isType("state") ? desc.name : desc.state;
  const state = stateName ? findChild(usa, stateName, "state", null) : null;
  if (!state) return path; // the country itself, or a state we can't match
  path.push(state);
  const afterState = state;

  // County
  const countyRaw = isType("county") ? desc.name : desc.county;
  let county = null;
  if (countyRaw) {
    const countyName = countyDisplayName(countyRaw, desc.countryCode);
    county = findChild(state, countyName, "county", null);
    if (!county) {
      county = addDynamicChild(state, { name: countyName, level: "county", center: here });
    }
    path.push(county);
  }

  // City / town
  const cityName = isType("city") ? desc.name : desc.city;
  let city = null;
  if (cityName) {
    city = county ? findChild(county, cityName, "city", null) : null;
    if (!city && !county) {
      // Result had no county: reuse the city if we already have it somewhere
      // under this state, and fix up the path to its real ancestors.
      const existing = findInSubtree(afterState, cityName, "city");
      if (existing) {
        const full = pathToNode(existing.id);
        path.length = 0;
        path.push(...full);
        city = existing;
      }
    }
    if (!city) {
      city = addDynamicChild(county || afterState, {
        name: cityName,
        level: "city",
        center: here,
      });
      if (!path.includes(city)) path.push(city);
    } else if (!path.includes(city)) {
      path.push(city);
    }
  }

  // District (e.g. a neighbourhood), only when it differs from the city above.
  if (isType("district") && city && normalizeName(desc.name) !== normalizeName(city.name)) {
    let district = findChild(city, desc.name, "district", null);
    if (!district) {
      district = addDynamicChild(city, { name: desc.name, level: "district", center: here });
    }
    path.push(district);
  }

  // Give the node we ended on the exact point/extent from the search so the
  // camera lands precisely (only for nodes made from search, never curated).
  const target = path[path.length - 1];
  if (target.dynamic) {
    target.center = here;
    if (desc.extent && isAdminType(desc.type)) target.extent = desc.extent;
  }
  return path;
}

function isAdminType(type) {
  return ["state", "county", "city", "district"].includes(type);
}
