// data/local-sources.js
// City wards and council districts. The Census doesn't publish these (every
// city draws its own), so they come from each city's open-data portal.
//
// TO ADD A CITY: add one entry to LOCAL_SOURCES below. That's it; the new
// layer appears automatically in the layer dock, the ballot tab and on the map.
//
// Entry fields
//   id        unique id, e.g. "boston-wards"
//   state     2-digit state FIPS ("25" = Massachusetts)
//   city      lowercase city name exactly as the Census spells it ("boston")
//   title     what to call it: "Ward", "City Council District"
//   type      "arcgis" (ArcGIS MapServer / FeatureServer layer) or
//             "socrata" (a Socrata `…/resource/<id>.geojson` dataset)
//   url       the layer URL (arcgis) or dataset .geojson URL (socrata)
//   field     the attribute holding the ward / district number or name
//   source    credit shown in the UI
//
// All entries below were checked to work from a browser (CORS) and to answer
// point-in-polygon queries.

export const LOCAL_SOURCES = [
  {
    id: "boston-wards",
    state: "25",
    city: "boston",
    title: "Ward",
    type: "arcgis",
    url: "https://gis.boston.gov/arcgis/rest/services/Planning/OpenData/MapServer/8",
    field: "WARD",
    source: "City of Boston Open Data",
  },
  {
    id: "boston-council",
    state: "25",
    city: "boston",
    title: "City Council District",
    type: "arcgis",
    url: "https://gis.boston.gov/arcgis/rest/services/Planning/OpenData/MapServer/4",
    field: "DISTRICT",
    source: "City of Boston Open Data",
  },
  {
    id: "chicago-wards",
    state: "17",
    city: "chicago",
    title: "Ward",
    type: "socrata",
    url: "https://data.cityofchicago.org/resource/p293-wvbd.geojson",
    field: "ward",
    source: "City of Chicago Data Portal",
  },
  {
    id: "nyc-council",
    state: "36",
    city: "new york",
    title: "City Council District",
    type: "socrata",
    url: "https://data.cityofnewyork.us/resource/872g-cjhh.geojson",
    field: "coundist",
    source: "NYC Open Data",
  },
];

const SIMPLIFY = 0.0004; // degrees; keeps downloads small

async function fetchJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Returns { value, geometry } for the polygon covering the point, or null.
async function lookup(src, lng, lat) {
  if (src.type === "arcgis") {
    const url = new URL(`${src.url}/query`);
    const params = {
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      outFields: src.field,
      returnGeometry: "true",
      outSR: "4326",
      maxAllowableOffset: String(SIMPLIFY),
      f: "geojson",
    };
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const data = await fetchJson(url.toString());
    const f = data.features?.[0];
    return f ? { value: f.properties[src.field], geometry: f.geometry } : null;
  }

  // Socrata: SoQL with a spatial filter + server-side simplification
  const url = new URL(src.url);
  url.searchParams.set(
    "$select",
    `${src.field}, simplify_preserve_topology(the_geom, ${SIMPLIFY}) as the_geom`
  );
  url.searchParams.set("$where", `intersects(the_geom, 'POINT (${lng} ${lat})')`);
  url.searchParams.set("$limit", "1");
  const data = await fetchJson(url.toString());
  const f = data.features?.[0];
  return f ? { value: f.properties[src.field], geometry: f.geometry } : null;
}

/**
 * Ward / council-district layers for the city at a point (may be empty).
 * @param {{name: string}} city  the "city" jurisdiction
 * @param {string} stateFips
 */
export async function findLocalLayers(city, stateFips, lng, lat) {
  const cityKey = String(city.name || "").trim().toLowerCase();
  const sources = LOCAL_SOURCES.filter((s) => s.state === stateFips && s.city === cityKey);
  const results = await Promise.all(
    sources.map(async (src) => {
      try {
        const hit = await lookup(src, lng, lat);
        if (!hit || hit.value == null || hit.value === "") return null;
        const value = String(hit.value);
        return {
          id: `ward:${src.id}:${value}`,
          kind: "ward",
          geoid: `${src.id}:${value}`,
          state: stateFips,
          name: `${src.title} ${value}`,
          short: `${src.title === "Ward" ? "Ward" : "Dist."} ${value}`,
          type: src.title,
          geometry: hit.geometry,
          center: [lng, lat],
          source: src.source,
        };
      } catch (err) {
        console.warn(`Local source ${src.id} failed:`, err);
        return null;
      }
    })
  );
  return results.filter(Boolean);
}
