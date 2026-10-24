// data/levels.js
// The administrative hierarchy the globe drills through.
// The order here drives breadcrumb depth, zoom behavior, and "move up / down" logic.
//
// Each level has:
//   key    - stable identifier used in code
//   label  - plain-language name shown in the UI
//   noun   - lowercase noun used in sentences ("Choose a state or region…")
//   zoom   - fallback MapLibre zoom when the camera lands on this level
//            (nodes with a `bbox` are framed to fit instead; see js/globe.js)
//
// SCOPE: the app is United States only for now, so the tree is
//   World -> United States -> State -> County -> City -> District.
// To support other countries later, add a "continent" level between globe and
// country here, add continent nodes in data/places.js, and widen the filters in
// js/geocode.js. Teams can also insert levels (e.g. "ward" below city) without
// touching the map or UI code.

export const LEVELS = [
  { key: "globe", label: "World", noun: "world", zoom: 1.5 },
  { key: "country", label: "Country", noun: "country", zoom: 3.4 },
  { key: "state", label: "State / Region", noun: "state or region", zoom: 6 },
  { key: "county", label: "County", noun: "county", zoom: 8.5 },
  { key: "city", label: "City / Town", noun: "city or town", zoom: 10.5 },
  { key: "district", label: "District", noun: "district", zoom: 12 },
];

// Fast lookups by key and by index.
export const LEVEL_INDEX = Object.fromEntries(
  LEVELS.map((lvl, i) => [lvl.key, i])
);

export function levelByKey(key) {
  const i = LEVEL_INDEX[key];
  return i === undefined ? null : LEVELS[i];
}

export function nextLevelKey(key) {
  const i = LEVEL_INDEX[key];
  if (i === undefined || i >= LEVELS.length - 1) return null;
  return LEVELS[i + 1].key;
}

export function prevLevelKey(key) {
  const i = LEVEL_INDEX[key];
  if (i === undefined || i <= 0) return null;
  return LEVELS[i - 1].key;
}
