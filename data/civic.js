// data/civic.js
// The ONE module the app talks to for political data. Right now it serves the
// sample data in data/places.js. To go live, replace the bodies of these
// functions with real API calls; nothing else in the app has to change.
//
// Suggested real sources
//   Races / candidates : Google Civic Information API, Ballotpedia, Open States,
//                        Vote Smart, state election offices
//   Events / town halls: Town Hall Project, Mobilize, city & county calendars
//                        (CivicPlus / Legistar / Granicus feeds), League of Women
//                        Voters "Vote411"
//   Geocoding          : see js/geocode.js
//
// Every function is async so swapping in fetch() is a drop-in change.

import {
  racesForNode,
  eventsForNode,
  resolveByCoords,
  ensurePath,
  pathToNode,
} from "./places.js";

// Races relevant to a place id (own + inherited from ancestors).
export async function fetchRacesForPlace(placeId) {
  return racesForNode(placeId);
}

// Upcoming political events relevant to a place id (own + inherited), soonest
// first. Each event: { id, title, type, start, end?, venue, virtual,
// description, url?, source, scopeName }.
export async function fetchEventsForPlace(placeId) {
  return eventsForNode(placeId);
}

// Turn a geocoder result (see js/geocode.js) into a path of place nodes from
// Earth down to the most specific place we can identify.
export async function resolvePlaceFromGeocode(desc) {
  return ensurePath(desc);
}

// Offline fallback: match raw GPS coordinates against curated bounding boxes.
export async function resolvePlaceByCoords(lng, lat) {
  return resolveByCoords(lng, lat);
}

// Convenience: breadcrumb path for a place id.
export async function fetchPathForPlace(placeId) {
  return pathToNode(placeId);
}
