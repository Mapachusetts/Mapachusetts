// data/census.js
// U.S. Census Bureau TIGERweb client: the source of real boundaries for every
// state, county, city/town, congressional district, state legislative district
// and school district in the country.
//
//   https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer
//
// Free, no API key, and allows browser requests (CORS). Layer IDs change as
// the Census adds new vintages (e.g. "120th Congressional Districts"), so they
// are looked up by NAME at runtime, with known IDs as a fallback.
//
// WHAT THIS GIVES THE APP
//   identifyStack(lng, lat)   -> every government layer covering a point
//   fetchBoundary(j)          -> the outline of one of those layers (GeoJSON)
//   listCounties(stateFips)   -> all counties in a state
//   listMunicipalities(county)-> all cities / towns in a county
//   childShapes(...)          -> clickable polygons for all states / a state's counties
//
// BOUNDARY CAVEAT: congressional and legislative maps are whatever the Census
// has published. States that redrew maps for 2026 may be ahead of (or behind)
// the Census data, so the UI tells people to confirm with their election office.

import { KIND_ORDER } from "./kinds.js";
import { findLocalLayers } from "./local-sources.js";

const SERVICE =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer";

const FALLBACK_IDS = {
  states: 80,
  counties: 82,
  congress: 54,
  senate: 56,
  house: 58,
  unified: 14,
  secondary: 16,
  elementary: 18,
  places: 28,
  cdp: 30,
  subdivisions: 22,
};

const NAME_PATTERNS = {
  states: /^States$/,
  counties: /^Counties$/,
  congress: /^\d+(st|nd|rd|th) Congressional Districts$/,
  senate: /State Legislative Districts - Upper$/,
  house: /State Legislative Districts - Lower$/,
  unified: /^Unified School Districts$/,
  secondary: /^Secondary School Districts$/,
  elementary: /^Elementary School Districts$/,
  places: /^Incorporated Places$/,
  cdp: /^Census Designated Places$/,
  subdivisions: /^County Subdivisions$/,
};

// States where towns/townships (county subdivisions) are the real local
// governments. Everywhere else, incorporated places are.
const STRONG_MCD_STATES = new Set([
  "09", "23", "25", "26", "27", "33", "34", "36", "42", "44", "50", "55",
]);

// How much to simplify each outline (degrees). Bigger = smaller download.
const SIMPLIFY = {
  state: 0.02,
  county: 0.004,
  congress: 0.004,
  senate: 0.003,
  house: 0.002,
  city: 0.0008,
  school: 0.0015,
  ward: 0.0005,
};

// ----- Plumbing --------------------------------------------------------------

const memo = new Map();
function remember(key, make) {
  if (!memo.has(key)) {
    const p = make().catch((err) => {
      memo.delete(key); // never cache failures
      throw err;
    });
    memo.set(key, p);
  }
  return memo.get(key);
}

async function getJson(url, signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Census service error (${res.status})`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || "Census query failed");
    return data;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function layerIds() {
  return remember("layer-ids", async () => {
    try {
      const svc = await getJson(`${SERVICE}?f=json`);
      const ids = { ...FALLBACK_IDS };
      for (const [key, pattern] of Object.entries(NAME_PATTERNS)) {
        const hit = (svc.layers || []).find(
          (l) => pattern.test(l.name) && !/Labels$/.test(l.name)
        );
        if (hit) ids[key] = hit.id;
      }
      return ids;
    } catch {
      return { ...FALLBACK_IDS };
    }
  });
}

async function query(layerKey, params, signal) {
  const ids = await layerIds();
  const url = new URL(`${SERVICE}/${ids[layerKey]}/query`);
  const all = { f: "json", outSR: "4326", ...params };
  for (const [k, v] of Object.entries(all)) url.searchParams.set(k, v);
  return getJson(url.toString(), signal);
}

const pointParams = (lng, lat) => ({
  geometry: `${lng},${lat}`,
  geometryType: "esriGeometryPoint",
  inSR: "4326",
  spatialRel: "esriSpatialRelIntersects",
  outFields: "*",
  returnGeometry: "false",
});

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// "Medford city" -> { name: "Medford", type: "City" }
function splitMunicipalName(attrs) {
  const full = String(attrs.NAME || "");
  const base = String(attrs.BASENAME || full);
  const rest = full.startsWith(base) ? full.slice(base.length).trim() : "";
  return { name: base, type: rest ? titleCase(rest) : "" };
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function districtLabel(stusab, base) {
  const clean = String(base || "").trim();
  if (!clean || /^0+$/.test(clean) || /at.?large/i.test(clean)) {
    return { short: `${stusab}-AL`, name: `U.S. House: ${stusab} At-Large` };
  }
  if (/^98$/.test(clean)) {
    return { short: `${stusab}-DEL`, name: "U.S. House: Delegate seat" };
  }
  const n = String(parseInt(clean, 10));
  return {
    short: `${stusab}-${n}`,
    name: `U.S. House: ${stusab}-${n} (${ordinal(parseInt(clean, 10))} District)`,
  };
}

// ----- The stack: every layer of government at a point ---------------------

/**
 * @typedef {Object} Jurisdiction
 * @property {string} id         e.g. "county:48157"
 * @property {string} kind       key of KINDS (data/kinds.js)
 * @property {string} name       "Fort Bend County"
 * @property {string} [short]    compact label for chips: "TX-22"
 * @property {string} [type]     "City", "Town", "Unified school district"...
 * @property {string} geoid      Census id (or the local source's id)
 * @property {string} [state]    2-digit state FIPS
 * @property {[number, number]} [center] [lng, lat] inside the area
 * @property {string} [layer]    internal: Census layer key for boundaries
 * @property {object} [geometry] GeoJSON geometry when already loaded
 * @property {string} [source]   where the data came from
 */

/**
 * Every layer of government covering a point.
 *
 * @param {number} lng
 * @param {number} lat
 * @param {{kinds?: string[], signal?: AbortSignal}} [opts]
 * @returns {Promise<{stack: Jurisdiction[], unincorporated: boolean,
 *                    unincorporatedName: string|null, inUS: boolean,
 *                    point: [number, number]}>}
 */
export function identifyStack(lng, lat, opts = {}) {
  const kinds = opts.kinds || KIND_ORDER;
  const key = `stack:${lng.toFixed(4)},${lat.toFixed(4)}:${kinds.join("+")}`;
  return remember(key, () => doIdentify(lng, lat, kinds, opts.signal));
}

async function doIdentify(lng, lat, kinds, signal) {
  const wants = (k) => kinds.includes(k);
  const q = (layer, extra = {}) =>
    query(layer, { ...pointParams(lng, lat), ...extra }, signal).then(
      (d) => d.features || []
    );

  const [state, county, congress, senate, house, unified, secondary, elementary, places, subs, cdp] =
    await Promise.all([
      q("states"),
      wants("county") ? q("counties") : [],
      wants("congress") ? q("congress") : [],
      wants("senate") ? q("senate") : [],
      wants("house") ? q("house") : [],
      wants("school") ? q("unified") : [],
      wants("school") ? q("secondary") : [],
      wants("school") ? q("elementary") : [],
      wants("city") ? q("places") : [],
      wants("city") ? q("subdivisions") : [],
      wants("city") ? q("cdp") : [],
    ]);

  const point = [lng, lat];
  if (!state.length) return { stack: [], unincorporated: false, inUS: false, point };

  const sa = state[0].attributes;
  const stusab = sa.STUSAB;
  const fips = sa.STATE;
  const stack = [];
  const push = (kind, a, fields) =>
    stack.push({
      id: `${kind}:${a.GEOID}`,
      kind,
      geoid: a.GEOID,
      state: fips,
      center: [num(a.INTPTLON) ?? num(a.CENTLON), num(a.INTPTLAT) ?? num(a.CENTLAT)],
      source: "U.S. Census Bureau (TIGERweb)",
      ...fields,
    });

  if (wants("country")) {
    stack.push({
      id: "country:US",
      kind: "country",
      geoid: "US",
      name: "United States",
      short: "USA",
      center: [-98.5, 39.8],
      source: "built in",
    });
  }
  if (wants("state")) push("state", sa, { name: sa.NAME, short: stusab, layer: "states" });
  if (county[0]) push("county", county[0].attributes, { name: county[0].attributes.NAME, layer: "counties" });
  if (congress[0]) {
    const a = congress[0].attributes;
    push("congress", a, { ...districtLabel(stusab, a.BASENAME), layer: "congress" });
  }
  if (senate[0]) {
    const a = senate[0].attributes;
    push("senate", a, { name: a.NAME, short: shortDistrict(a.BASENAME), layer: "senate" });
  }
  if (house[0]) {
    const a = house[0].attributes;
    push("house", a, { name: a.NAME, short: shortDistrict(a.BASENAME), layer: "house" });
  }
  for (const [list, layer, type] of [
    [unified, "unified", "Unified"],
    [elementary, "elementary", "Elementary"],
    [secondary, "secondary", "Secondary"],
  ]) {
    for (const f of list) {
      push("school", f.attributes, {
        name: f.attributes.NAME,
        type: `${type} school district`,
        layer,
      });
    }
  }

  // City / town: incorporated place and/or county subdivision (see top note).
  let unincorporated = false;
  let unincorporatedName = null;
  if (wants("city")) {
    const strong = STRONG_MCD_STATES.has(fips);
    const mcd = subs.find((f) => f.attributes.FUNCSTAT !== "S");
    const place = places[0];
    const found = [];
    if (place) {
      const { name, type } = splitMunicipalName(place.attributes);
      found.push({ a: place.attributes, name, type, layer: "places" });
    }
    if (strong && mcd) {
      const { name, type } = splitMunicipalName(mcd.attributes);
      const same = found.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (same) {
        // Same government listed twice (e.g. "Medford city"): keep the
        // county-subdivision record in New England-style states.
        same.a = mcd.attributes;
        same.layer = "subdivisions";
      } else {
        found.push({ a: mcd.attributes, name, type, layer: "subdivisions" });
      }
    }
    for (const c of found) push("city", c.a, { name: c.name, type: c.type, layer: c.layer });
    unincorporated = found.length === 0;
    if (unincorporated && cdp[0]) {
      unincorporatedName = splitMunicipalName(cdp[0].attributes).name;
    }
  }

  // Wards / council districts from city open-data portals (see local-sources.js)
  if (wants("ward")) {
    const city = stack.find((j) => j.kind === "city");
    if (city) {
      try {
        stack.push(...(await findLocalLayers(city, fips, lng, lat)));
      } catch (err) {
        console.warn("Local ward lookup failed:", err);
      }
    }
  }

  const order = (j) => KIND_ORDER.indexOf(j.kind);
  stack.sort((a, b) => order(a) - order(b));
  return { stack, unincorporated, unincorporatedName, inUS: true, point };
}

function shortDistrict(base) {
  const b = String(base || "");
  return b.length > 14 ? b.slice(0, 13) + "…" : b;
}

// ----- Boundaries -------------------------------------------------------------

/**
 * GeoJSON geometry for one jurisdiction (cached). Returns null for the country
 * (too large to draw usefully) or if the lookup fails.
 * @param {Jurisdiction} j
 */
export function fetchBoundary(j) {
  if (j.geometry) return Promise.resolve(j.geometry);
  if (j.kind === "country" || !j.layer) return Promise.resolve(null);
  return remember(`boundary:${j.id}`, async () => {
    const data = await query(j.layer, {
      where: `GEOID='${j.geoid}'`,
      outFields: "GEOID",
      returnGeometry: "true",
      maxAllowableOffset: String(SIMPLIFY[j.kind] ?? 0.002),
      f: "geojson",
    });
    return data.features?.[0]?.geometry || null;
  }).catch(() => null);
}

// ----- Lists for menus and clickable shapes ----------------------------------

/** All counties (or county equivalents) in a state, A to Z. */
export function listCounties(stateFips) {
  return remember(`counties:${stateFips}`, async () => {
    const d = await query("counties", {
      where: `STATE='${stateFips}'`,
      outFields: "GEOID,NAME,BASENAME,INTPTLAT,INTPTLON,CENTLAT,CENTLON",
      returnGeometry: "false",
      orderByFields: "NAME",
      resultRecordCount: "500",
    });
    return (d.features || []).map((f) => ({
      geoid: f.attributes.GEOID,
      name: f.attributes.NAME,
      center: [
        num(f.attributes.INTPTLON) ?? num(f.attributes.CENTLON),
        num(f.attributes.INTPTLAT) ?? num(f.attributes.CENTLAT),
      ],
    }));
  });
}

/**
 * Cities and towns in a county.
 * - New England-style states: the county's towns (county subdivisions).
 * - Elsewhere: incorporated places whose internal point lies in the county.
 * @param {{geoid: string, state?: string}} county
 */
export function listMunicipalities(county) {
  return remember(`munis:${county.geoid}`, async () => {
    const stateFips = county.geoid.slice(0, 2);
    const countyFips = county.geoid.slice(2);
    const fields = "GEOID,NAME,BASENAME,FUNCSTAT,INTPTLAT,INTPTLON,CENTLAT,CENTLON";
    const toItem = (a) => {
      const { name, type } = splitMunicipalName(a);
      return {
        geoid: a.GEOID,
        name,
        type,
        layer: "places",
        center: [num(a.INTPTLON) ?? num(a.CENTLON), num(a.INTPTLAT) ?? num(a.CENTLAT)],
      };
    };

    if (STRONG_MCD_STATES.has(stateFips)) {
      const d = await query("subdivisions", {
        where: `STATE='${stateFips}' AND COUNTY='${countyFips}'`,
        outFields: fields,
        returnGeometry: "false",
        orderByFields: "NAME",
        resultRecordCount: "500",
      });
      return (d.features || [])
        .filter((f) => f.attributes.FUNCSTAT !== "S")
        .map((f) => ({ ...toItem(f.attributes), layer: "subdivisions" }));
    }

    // Other states: places inside the county's bounding box, then keep the ones
    // whose internal point is truly inside the county outline.
    const outline = await fetchBoundary({
      id: `county:${county.geoid}`,
      kind: "county",
      geoid: county.geoid,
      layer: "counties",
    });
    if (!outline) return [];
    const [w, s, e, n] = bboxOf(outline);
    const d = await query("places", {
      geometry: `${w},${s},${e},${n}`,
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelEnvelopeIntersects",
      where: `STATE='${stateFips}'`,
      outFields: fields,
      returnGeometry: "false",
      orderByFields: "NAME",
      resultRecordCount: "2000",
    });
    return (d.features || [])
      .map((f) => toItem(f.attributes))
      .filter((p) => p.center[0] != null && pointInGeometry(p.center[0], p.center[1], outline));
  });
}

/**
 * Clickable shapes for the map: every state, or every county in a state.
 * @param {"states"|"counties"} what
 * @param {string} [stateFips]
 * @returns {Promise<object>} GeoJSON FeatureCollection; each feature has
 *   properties { id, name, short, geoid }
 */
export function childShapes(what, stateFips) {
  const key = what === "states" ? "shapes:states" : `shapes:counties:${stateFips}`;
  return remember(key, async () => {
    const isStates = what === "states";
    const d = await query(isStates ? "states" : "counties", {
      where: isStates ? "1=1" : `STATE='${stateFips}'`,
      // (STUSAB only exists on the states layer)
      outFields: isStates ? "GEOID,NAME,BASENAME,STUSAB" : "GEOID,NAME,BASENAME",
      returnGeometry: "true",
      maxAllowableOffset: String(isStates ? 0.04 : 0.008),
      resultRecordCount: "500",
      f: "geojson",
    });
    return {
      type: "FeatureCollection",
      features: (d.features || [])
        // keep the 50 states + DC (the layer also has territories)
        .filter((f) => !isStates || /^(0[1-9]|[1-4]\d|5[0-6])$/.test(f.properties.GEOID))
        .map((f) => ({
          type: "Feature",
          geometry: f.geometry,
          properties: {
            id: isStates ? `us-${String(f.properties.STUSAB).toLowerCase()}` : `county:${f.properties.GEOID}`,
            name: f.properties.NAME,
            short: isStates ? f.properties.STUSAB : f.properties.BASENAME,
            geoid: f.properties.GEOID,
          },
        })),
    };
  });
}

// ----- Geometry helpers -----------------------------------------------------

/** [west, south, east, north] of a GeoJSON geometry. */
export function bboxOf(geometry) {
  let w = 180, s = 90, e = -180, n = -90;
  const visit = (c) => {
    if (typeof c[0] === "number") {
      if (c[0] < w) w = c[0];
      if (c[0] > e) e = c[0];
      if (c[1] < s) s = c[1];
      if (c[1] > n) n = c[1];
    } else {
      c.forEach(visit);
    }
  };
  visit(geometry.coordinates);
  return [w, s, e, n];
}

/** Ray-casting point-in-polygon for Polygon / MultiPolygon geometries. */
export function pointInGeometry(lng, lat, geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polys.some((rings) => {
    if (!inRing(lng, lat, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) if (inRing(lng, lat, rings[i])) return false; // hole
    return true;
  });
}

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
