// data/civic.js
// The ONE module the app talks to for political and geographic data.
//
//   GEOGRAPHY (real, from the U.S. Census Bureau + city open-data portals)
//     fetchStack / resolveFromPoint  which layers of government cover a point
//     fetchBoundary                  the outline of one layer
//     loadChildren                   every county in a state / city in a county
//     fetchChildShapes               clickable state / county polygons
//
//   POLITICS (real data; nothing is invented)
//     fetchRacesForPlace             what's on the ballot: every U.S. Senate,
//                                    Governor and U.S. House nominee, from
//                                    data/candidates.js
//     fetchOfficeholdersForPlace     who holds each office now, on the ballot or
//                                    not (data/officeholders.js)
//     fetchEventsForPlace            Election Day, plus real city council and
//                                    committee meetings (data/events.generated.js)
//     MISSING: state legislature, county, city and school-board candidates have
//     no free national source. See "Adding more" below.
//
// ADDING MORE
//   Each race needs a `kind` (which layer of government decides it, see
//   data/kinds.js) and the UI does the rest. Races for districts can be keyed on
//   the jurisdiction ids in `stack` (e.g. "congress:4822", "school:4819650",
//   "senate:48017"). Sources that cover state legislative / local candidates:
//     Ballotpedia API, BallotReady API (paid), Google Civic voterInfoQuery
//     (needs a key; only during supported elections), or your own research
//     database. Add them inside fetchRacesForPlace below.
//
// Every function is async so swapping in fetch() is a drop-in change.

import {
  racesForNode,
  eventsForNode,
  resolveByCoords,
  ensurePath,
  pathToNode,
  attachChildren,
  pathFromStack,
} from "./places.js";
import {
  identifyStack,
  fetchBoundary as censusBoundary,
  listCounties,
  listMunicipalities,
  childShapes,
} from "./census.js";
import { kindsForLevel } from "./kinds.js";
import { racesForPlace } from "./candidates.js";
import { officeholdersForPlace } from "./officeholders.js";
import { EVENTS, EVENTS_META } from "./events.generated.js";
import { electionDayEvent } from "./events.js";

// ===== Geography ============================================================

/**
 * The stack of government layers for a place. `level` decides how much to look
 * up (a state needs only country + state; a city needs everything).
 * @param {[number, number]} point  [lng, lat]
 * @param {"globe"|"country"|"state"|"county"|"city"|"district"} level
 */
export function fetchStack(point, level, signal) {
  const kinds = kindsForLevel(level);
  if (!kinds.length) return Promise.resolve({ stack: [], inUS: true, point });
  return identifyStack(point[0], point[1], { kinds, signal });
}

/**
 * Resolve a coordinate (search result or GPS) to a path in the place tree.
 * @param {number} downTo  deepest level wanted: "state" | "county" | "city"
 * @returns {Promise<{path: object[], stack: object[], unincorporated: boolean,
 *                    unincorporatedName: string|null}>}
 *   path is just [Earth] when the point is not in the U.S.
 */
export async function resolveFromPoint(lng, lat, downTo = "city") {
  const res = await identifyStack(lng, lat, { kinds: kindsForLevel(downTo) });
  if (!res.inUS) return { path: pathToNode("globe"), stack: [], unincorporated: false };
  return {
    path: pathFromStack(res.stack, downTo),
    stack: res.stack,
    unincorporated: res.unincorporated,
    unincorporatedName: res.unincorporatedName,
  };
}

export function fetchBoundary(jurisdiction) {
  return censusBoundary(jurisdiction);
}

// Fill in a node's children from the Census: a state's counties, a county's
// cities and towns. Safe to call repeatedly.
const loading = new Map();
export function loadChildren(node) {
  if (node.childrenState === "loaded") return Promise.resolve();
  if (loading.has(node.id)) return loading.get(node.id);

  let job = null;
  if (node.level === "state" && node.geoid) {
    job = listCounties(node.geoid).then((items) => attachChildren(node, items, "county"));
  } else if (node.level === "county" && node.geoid) {
    job = listMunicipalities({ geoid: node.geoid }).then((items) =>
      attachChildren(node, items, "city")
    );
  }
  if (!job) return Promise.resolve();

  node.childrenState = "loading";
  const wrapped = job
    .catch((err) => {
      console.warn(`Could not load places inside ${node.name}:`, err);
      node.childrenState = "error";
    })
    .finally(() => loading.delete(node.id));
  loading.set(node.id, wrapped);
  return wrapped;
}

/**
 * Clickable outlines for the places directly below a node: every state (from
 * the U.S. view) or every county (from a state). Null for other levels.
 */
export async function fetchChildShapes(node) {
  try {
    if (node.level === "country") return await childShapes("states");
    if (node.level === "state" && node.geoid) return await childShapes("counties", node.geoid);
  } catch (err) {
    console.warn("Could not load outlines:", err);
  }
  return null;
}

// Fallbacks used only when the Census service can't be reached.
export async function resolvePlaceFromGeocode(desc) {
  return ensurePath(desc);
}
export async function resolvePlaceByCoords(lng, lat) {
  return resolveByCoords(lng, lat);
}
export async function fetchPathForPlace(placeId) {
  return pathToNode(placeId);
}

// ===== Politics (real data) ==================================================

/**
 * Everything on the ballot for a place that we have real data for.
 *
 * - Statewide: U.S. Senate and Governor (when the state has one in 2026).
 * - U.S. House: ONE race, for the person's own district, taken from the Census
 *   stack. On a state's own page every district is listed instead.
 *
 * @param {string} placeId
 * @param {object[]} [stack]  from fetchStack (empty is fine)
 */
export async function fetchRacesForPlace(placeId, stack = []) {
  const path = pathToNode(placeId);
  const stateNode = path.find((n) => n.level === "state");
  if (!stateNode) return [];

  const atState = path[path.length - 1].level === "state";
  const congress = stack.find((j) => j.kind === "congress");
  const races = racesForPlace(stateNode.code, {
    congress: congress ? congress.short : null,
    allHouse: atState,
  });

  // Hand-attached races on a place node (none ship today; see places.js).
  return [...races, ...racesForNode(placeId).map((r) => ({ source: "curated", ...r }))];
}

/**
 * Who holds office right now in the layers of government at a place, whether or
 * not the seat is on the ballot (see data/officeholders.js for what is covered).
 *
 * @param {string} placeId
 * @param {object[]} stack  from fetchStack; holders are matched to its layers
 */
export async function fetchOfficeholdersForPlace(placeId, stack = []) {
  const state = pathToNode(placeId).find((n) => n.level === "state");
  return officeholdersForPlace({ stateCode: state ? state.code : null, stack });
}

/** Upcoming events: Election Day for everyone, plus real local meetings. */
export async function fetchEventsForPlace(placeId, stack = []) {
  const now = new Date();
  const cityIds = new Set(stack.filter((j) => j.kind === "city").map((j) => j.geoid));
  // A city node's own Census id also counts (stacks aren't loaded yet on first paint).
  const node = pathToNode(placeId).slice(-1)[0];
  if (node && node.geoid) cityIds.add(node.geoid);

  const local = EVENTS.filter(
    (e) => cityIds.has(e.geoid) && !e.cancelled && new Date(e.start) >= startOfToday(now)
  ).map((e) => ({
    ...e,
    virtual: false,
    description: e.agendaUrl ? "Agenda posted." : "",
    scopeName: e.city,
  }));

  const electionDay = electionDayEvent("2026-11-03");
  const all = new Date(electionDay.start) >= startOfToday(now) ? [electionDay] : [];

  return [...all, ...local, ...eventsForNode(placeId)].sort(
    (a, b) => new Date(a.start) - new Date(b.start)
  );
}

const startOfToday = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Which cities have a live meeting calendar (for the "coverage" note in the UI). */
export function meetingCoverage() {
  return EVENTS_META.cities.map((c) => ({ city: c.city, state: c.state, geoid: c.geoid }));
}

/** When the meeting calendar was last refreshed (ISO string). */
export function eventsGeneratedAt() {
  return EVENTS_META.generatedAt;
}
