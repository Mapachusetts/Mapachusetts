// data/civic.js
// The ONE module the app talks to for political and geographic data.
//
//   GEOGRAPHY (real, from the U.S. Census Bureau + city open-data portals)
//     fetchStack / resolveFromPoint  which layers of government cover a point
//     fetchBoundary                  the outline of one layer
//     loadChildren                   every county in a state / city in a county
//     fetchChildShapes               clickable state / county polygons
//
//   POLITICS (SAMPLE placeholders today: replace these with your real data)
//     fetchRacesForPlace             what's on the ballot
//     fetchEventsForPlace            town halls, meetings, voting dates
//
// To plug in a real dataset (e.g. your Supabase tables), replace the bodies of
// fetchRacesForPlace / fetchEventsForPlace. Each race needs a `kind` (which
// layer of government decides it, see data/kinds.js) and the UI does the rest.
// Races for districts can be keyed on the jurisdiction ids in `stack`
// (e.g. "congress:4822", "school:4819650", "senate:48017").
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
import {
  makeHouseRace,
  makeStateLegislatorRace,
  makeSchoolBoardRace,
} from "./races.js";

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

// ===== Politics (sample data today) ========================================

/**
 * Everything on the ballot for a place: races attached to the place (and its
 * ancestors) plus, for every district in `stack`, the office that district
 * elects. Each race has a `kind` (layer of government) and a `source`.
 *
 * @param {string} placeId
 * @param {object[]} [stack]  from fetchStack (empty is fine)
 */
export async function fetchRacesForPlace(placeId, stack = []) {
  const curated = racesForNode(placeId);
  const state = stack.find((j) => j.kind === "state");
  const generated = [];
  for (const j of stack) {
    let race = null;
    if (j.kind === "congress") race = makeHouseRace(j.short);
    else if (j.kind === "senate") race = makeStateLegislatorRace("senate", j.name, state?.name || "the state");
    else if (j.kind === "house") race = makeStateLegislatorRace("house", j.name, state?.name || "the state");
    else if (j.kind === "school") {
      race = makeSchoolBoardRace(`${j.name} board`, `the public schools in ${j.name}`);
    }
    if (race) {
      generated.push({
        ...race,
        id: `gen-${j.id}`,
        jurisdictionId: j.id,
        scopeName: j.name,
        scopeLevel: j.kind,
      });
    }
  }
  return [...curated, ...generated].map((r) => ({ source: "sample", ...r }));
}

/**
 * Upcoming civic events for a place (own + inherited), soonest first.
 * Each: { id, title, kind?, type, start, end?, venue, virtual, description,
 * url?, source, scopeName }.
 */
export async function fetchEventsForPlace(placeId) {
  return eventsForNode(placeId);
}
