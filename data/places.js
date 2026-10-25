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
// This file is GEOGRAPHY ONLY. Counties and cities are loaded from the Census
// the first time someone opens their parent (see loadChildren in data/civic.js),
// and anything searched for is created on the fly (ensurePath).
//
// It holds NO candidates or events: those come from data/candidates.js (real
// nominees) and data/civic.js (real meetings). A node's optional `races` and
// `events` arrays are still honored by racesForNode / eventsForNode, so a
// teammate can attach a hand-researched local race to a place, but nothing
// ships in them today.

import { LEVEL_INDEX } from "./levels.js";
import { US_STATES, STATE_ZOOM } from "./us-states.js";

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
  extent: [-125.5, 24.3, -66.5, 49.8], // lower 48; the camera frames this box
  children: US_STATES.map(([code, name, lng, lat, fips]) =>
    node({
      id: `us-${code.toLowerCase()}`,
      geoid: fips, // Census state id; county ids start with it
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

// ----- Index + parent links -------------------------------------------------

const INDEX = new Map();

function register(n, parent = null) {
  n.parent = parent;
  INDEX.set(n.id, n);
  for (const child of n.children) register(child, n);
}
register(PLACES);

// Which layer of government a place level corresponds to (for races/events
// that don't say so explicitly).
const LEVEL_TO_KIND = {
  country: "country",
  state: "state",
  county: "county",
  city: "city",
  district: "ward",
};

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
      out.push({
        ...race,
        kind: race.kind || LEVEL_TO_KIND[n.level],
        scopeName: n.name,
        scopeLevel: n.level,
      });
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
      out.push({
        ...evt,
        kind: evt.kind || LEVEL_TO_KIND[n.level],
        scopeName: n.name,
        scopeLevel: n.level,
      });
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

// ----- Census-backed children (every county, every city) ---------------------
//
// Counties and cities are NOT bundled. They are loaded from the Census Bureau
// the first time someone opens a state or county (see loadChildren in
// data/civic.js) and added to the tree here. Curated nodes above are reused
// (matched by Census id, then by name) so their sample races/events stay.

function findChildByGeoid(parent, geoid) {
  return parent.children.find((c) => c.geoid === geoid) || null;
}

// Find-or-create a child. `item`: { geoid, name, center, type?, layer? }.
function upsertChild(parent, item, level) {
  let child =
    findChildByGeoid(parent, item.geoid) ||
    findChild(parent, item.name, level, null);
  if (child) {
    if (!child.geoid) child.geoid = item.geoid;
    if (item.layer) child.layer = item.layer;
    if (item.type) child.type = item.type;
    return child;
  }
  // Ids must be unique tree-wide. A city that sits in several counties (New
  // York City) gets one node per county.
  let id = `${level}:${item.geoid}`;
  if (INDEX.has(id)) id = `${id}@${parent.id}`;
  child = node({
    id,
    geoid: item.geoid,
    name: item.name,
    level,
    center: item.center,
    layer: item.layer,
    type: item.type,
    dynamic: true,
  });
  child.parent = parent;
  parent.children.push(child);
  INDEX.set(child.id, child);
  return child;
}

/**
 * Add a batch of children loaded from the Census to a node.
 * @param {object} parent
 * @param {{geoid: string, name: string, center: number[], type?: string, layer?: string}[]} items
 * @param {"county"|"city"} level
 */
export function attachChildren(parent, items, level) {
  const nodes = items.map((it) => upsertChild(parent, it, level));
  parent.childrenState = "loaded";
  return nodes;
}

/**
 * Turn a stack of jurisdictions (data/census.js) into a path of place nodes,
 * creating county / city nodes as needed.
 * @param {object[]} stack
 * @param {"state"|"county"|"city"} [downTo]  deepest level to go to
 * @returns {object[]} path from Earth down; just [Earth] if not in the U.S.
 */
export function pathFromStack(stack, downTo = "city") {
  const stateJ = stack.find((j) => j.kind === "state");
  const state = stateJ && usa.children.find((s) => s.code === stateJ.short);
  if (!state) return [PLACES];
  const path = [PLACES, usa, state];
  if (downTo === "state") return path;

  const countyJ = stack.find((j) => j.kind === "county");
  if (!countyJ) return path;
  const county = upsertChild(
    state,
    { geoid: countyJ.geoid, name: countyJ.name, center: countyJ.center, layer: "counties" },
    "county"
  );
  path.push(county);
  if (downTo === "county") return path;

  const cityJ = stack.find((j) => j.kind === "city");
  if (!cityJ) return path;
  const city = upsertChild(
    county,
    {
      geoid: cityJ.geoid,
      name: cityJ.name,
      center: cityJ.center,
      type: cityJ.type,
      layer: cityJ.layer,
    },
    "city"
  );
  path.push(city);
  return path;
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
