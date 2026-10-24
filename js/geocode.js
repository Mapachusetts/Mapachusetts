// js/geocode.js
// Place search + reverse geocoding using Photon (https://photon.komoot.io), a
// free, key-less geocoder built on OpenStreetMap data that supports
// search-as-you-type.
//
// PRIVACY: what the user types in the search box, and (only when they press
// "Use my location") their coordinates, are sent to photon.komoot.io. Nothing
// else leaves the browser. If you self-host Photon or switch providers, change
// PHOTON_URL below and adapt `toDescriptor`.
//
// Fair use: the public instance is shared, so keep the debounce in search.js
// and don't hammer it. For production, self-host or use a paid provider.
//
// SCOPE: United States only. Searches are limited to a bounding box around the
// 50 states + DC, and results are also filtered by country code (the box
// overlaps Canada and Mexico). Widen both to support more countries.

const PHOTON_URL = "https://photon.komoot.io";

// minLon, minLat, maxLon, maxLat: covers the 50 states, including Alaska and Hawaii.
const US_BBOX = "-179.3,18.8,-66.8,71.6";

// Only return real places (not shops, airports, hospitals, ...).
const PLACE_LAYERS = ["city", "county", "state", "district", "locality"];

// Normalized shape the rest of the app uses:
//   { type, name, country, countryCode, state, county, city, lng, lat, extent, label }
function toDescriptor(feature) {
  const p = feature.properties || {};
  const [lng, lat] = feature.geometry.coordinates;
  // Photon's extent is [minLon, maxLat, maxLon, minLat]; convert to
  // [west, south, east, north].
  const extent = Array.isArray(p.extent)
    ? [p.extent[0], p.extent[3], p.extent[2], p.extent[1]]
    : null;
  const desc = {
    type: p.type || "locality",
    name: p.name || "",
    country: p.country || "",
    countryCode: (p.countrycode || "").toUpperCase(),
    state: p.state || "",
    county: p.county || "",
    city: p.city || "",
    lng,
    lat,
    extent,
  };
  desc.label = describe(desc);
  return desc;
}

// Human-friendly label such as "Medford, Middlesex County, Massachusetts, United States".
export function describe(d) {
  const county =
    d.county && d.countryCode === "US" && !/county|parish|borough/i.test(d.county)
      ? `${d.county} County`
      : d.county;
  const parts = [];
  const add = (v) => {
    if (v && !parts.includes(v)) parts.push(v);
  };
  add(d.name);
  if (d.type !== "city" || !d.county) add(d.city);
  if (d.type !== "county") add(county);
  if (d.type !== "state") add(d.state);
  // Everything is in the U.S., so only name the country when it isn't.
  if (d.countryCode !== "US" && d.type !== "country") add(d.country);
  return parts.join(", ");
}

function buildUrl(path, params) {
  const url = new URL(path, PHOTON_URL);
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((item) => url.searchParams.append(k, item));
    else url.searchParams.set(k, v);
  }
  return url.toString();
}

/**
 * Search for places matching free text, e.g. "Sugar Land, TX".
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @returns {Promise<object[]>} descriptors, best match first
 */
export async function searchPlaces(query, signal) {
  const q = query.trim();
  if (q.length < 2) return [];
  const res = await fetch(
    buildUrl("/api/", {
      q,
      limit: 15, // fetch extra: some results are dropped by the U.S. filter
      lang: "en",
      bbox: US_BBOX,
      layer: PLACE_LAYERS,
    }),
    { signal }
  );
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const data = await res.json();

  const seen = new Set();
  const results = [];
  for (const f of data.features || []) {
    const d = toDescriptor(f);
    if (!d.name || d.countryCode !== "US") continue;
    const key = d.label.toLowerCase();
    if (seen.has(key)) continue; // Photon sometimes returns near-duplicates
    seen.add(key);
    results.push(d);
    if (results.length >= 6) break;
  }
  return results;
}

/**
 * Find the place at a coordinate (used by "Use my location").
 * @returns {Promise<object|null>}
 */
export async function reversePlace(lng, lat, signal) {
  const res = await fetch(
    buildUrl("/reverse", { lon: lng, lat, lang: "en", limit: 1 }),
    { signal }
  );
  if (!res.ok) throw new Error(`Reverse lookup failed (${res.status})`);
  const data = await res.json();
  const feature = (data.features || [])[0];
  return feature ? toDescriptor(feature) : null;
}
