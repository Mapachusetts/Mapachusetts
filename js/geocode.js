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
// WHAT YOU CAN TYPE: a city, county or state; a 5-digit ZIP code; or a street
// address ("1600 Pennsylvania Ave NW, Washington"). A street address is the most
// precise way to find your districts, and the most sensitive thing this app
// sends anywhere: it goes to the geocoder as plain text. Upgrade path: proxy the
// U.S. Census geocoder (geocoding.geo.census.gov) from your own server so
// addresses stay with the U.S. government; it has no browser (CORS) access.
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
    street: p.street || "",
    housenumber: p.housenumber || "",
    postcode: p.postcode || "",
    lng,
    lat,
    extent,
  };
  desc.label = describe(desc);
  return desc;
}

// Human-friendly label such as "Medford, Middlesex County, Massachusetts, United States".
export function describe(d) {
  // Street addresses read as "1600 Pennsylvania Avenue NW, Washington, DC".
  if ((d.type === "house" || d.type === "street") && d.street) {
    const line = [d.housenumber, d.street].filter(Boolean).join(" ");
    return [line, d.city, d.state].filter(Boolean).join(", ");
  }
  if (d.isZip) return [`ZIP ${d.name}`, d.city, d.state].filter(Boolean).join(", ");
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

  const isZip = /^\d{5}(-\d{4})?$/.test(q);
  const looksLikeAddress = /^\d+[A-Za-z]?\s+\S+/.test(q) && !isZip;

  // Places always; street addresses too when the text starts with a number;
  // ZIP codes need an unfiltered request (Photon files them under "other").
  const requests = [];
  if (isZip) {
    requests.push(
      fetchJson(buildUrl("/api/", { q: q.slice(0, 5), limit: 5, lang: "en", bbox: US_BBOX }), signal)
    );
  } else {
    requests.push(
      fetchJson(buildUrl("/api/", { q, limit: 15, lang: "en", bbox: US_BBOX, layer: PLACE_LAYERS }), signal)
    );
    if (looksLikeAddress) {
      requests.unshift(
        fetchJson(buildUrl("/api/", { q, limit: 6, lang: "en", bbox: US_BBOX, layer: ["house", "street"] }), signal)
      );
    }
  }
  const responses = await Promise.all(requests.map((r) => r.catch((err) => (err.name === "AbortError" ? Promise.reject(err) : { features: [] }))));

  const seen = new Set();
  const results = [];
  for (const data of responses) {
    for (const f of data.features || []) {
      const d = toDescriptor(f);
      if (isZip) {
        if (d.type !== "other" || d.name !== q.slice(0, 5)) continue;
        d.isZip = true;
        d.label = describe(d);
      }
      if (!d.name || d.countryCode !== "US") continue;
      const key = d.label.toLowerCase();
      if (seen.has(key)) continue; // Photon sometimes returns near-duplicates
      seen.add(key);
      results.push(d);
      if (results.length >= 6) return results;
    }
  }
  return results;
}

async function fetchJson(url, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return res.json();
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
