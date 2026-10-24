/* Mapachusetts — voting ward / precinct map with hover highlighting.
 *
 * Data source (public domain):
 *   U.S. Census TIGERweb "Voting Districts" layer (id 58 on the Census 2020
 *   service). Per the Census Bureau, a voting district is the generic name for
 *   precincts, wards, and election districts that state governments define for
 *   conducting elections. This is the nationwide "wards within cities" layer.
 *
 * Rendering strategy (same for MA and the whole US):
 *   There are ~2,157 voting districts in Massachusetts alone and hundreds of
 *   thousands nationwide, so drawing them all as vector polygons at once is not
 *   feasible. Instead we draw the ward boundaries as map tiles (WMS) and, on
 *   hover, run an ArcGIS "identify" to fetch and highlight just the single ward
 *   under the cursor as an opaque polygon.
 */

const TIGER_BASE =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer";
const VTD_LAYER = 58; // Voting Districts (precincts / wards / election districts)
const VTD_MIN_ZOOM = 10; // layer only renders when zoomed in (minScale 325k)

// ---------------------------------------------------------------------------
// Map setup
// ---------------------------------------------------------------------------
const map = L.map("map", {
  center: [42.34, -71.06], // Boston — shows real ward/precinct splits
  zoom: 12,
  minZoom: 3,
  maxZoom: 18,
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | Voting districts: U.S. Census Bureau TIGERweb',
  maxZoom: 19,
}).addTo(map);

const infoName = document.getElementById("hoverName");
const infoMeta = document.getElementById("hoverMeta");
const hintEl = document.getElementById("mapHint");
const scopeSelect = document.getElementById("scopeSelect");

const highlightStyle = {
  color: "#ffb703",
  weight: 2.5,
  opacity: 1,
  fillColor: "#ffb703",
  fillOpacity: 0.9, // opaque highlight
};

function setInfo(name, meta) {
  infoName.textContent = name || "—";
  infoMeta.textContent = meta || "";
}

function setHint(text) {
  hintEl.textContent = text;
  hintEl.style.display = text ? "block" : "none";
}

// FIPS state code -> abbreviation, for labels.
const STATE_FIPS = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO",
  "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI",
  "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY",
  "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH",
  "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD",
  "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY", "72": "PR",
};

// Turn a raw voting-district name into something readable.
// Many New England cities encode wards + precincts as a 4-digit "WWPP" code
// (e.g. Boston "1504" = Ward 15, Precinct 4). Expand that when we can; other
// states use free-form precinct names, which we pass through unchanged.
function formatWardName(attrs) {
  const raw = (attrs.BASENAME || attrs.NAME || "").trim();
  if (!raw) return "Unknown district";

  if (/^\d{4}$/.test(raw)) {
    const ward = parseInt(raw.slice(0, 2), 10);
    const precinct = parseInt(raw.slice(2), 10);
    if (ward > 0) return `Ward ${ward}, Precinct ${precinct}`;
    return `Precinct ${precinct}`;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Ward boundary tiles (ArcGIS MapServer exposes an OGC WMS endpoint)
// ---------------------------------------------------------------------------
let wardTiles = null;
function getWardTiles() {
  if (!wardTiles) {
    wardTiles = L.tileLayer.wms(`${TIGER_BASE}/WMSServer`, {
      layers: String(VTD_LAYER),
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      attribution: "U.S. Census Bureau TIGERweb",
    });
  }
  return wardTiles;
}

// Convert an Esri polygon (rings) to GeoJSON for Leaflet.
function esriPolygonToGeoJSON(geometry) {
  if (!geometry || !geometry.rings) return null;
  return { type: "Polygon", coordinates: geometry.rings };
}

// ---------------------------------------------------------------------------
// Hover identify: highlight the single ward under the cursor
// ---------------------------------------------------------------------------
let highlightLayer = null;
let identifyTimer = null;
let identifyToken = 0;

async function identifyAt(latlng) {
  const token = ++identifyToken;
  const size = map.getSize();
  const b = map.getBounds();
  const mapExtent = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(
    ","
  );

  // identify only speaks Esri JSON (f=json), not geojson.
  const url =
    `${TIGER_BASE}/identify?` +
    new URLSearchParams({
      geometry: `${latlng.lng},${latlng.lat}`,
      geometryType: "esriGeometryPoint",
      sr: "4326",
      layers: `all:${VTD_LAYER}`,
      mapExtent,
      imageDisplay: `${size.x},${size.y},96`,
      tolerance: "3",
      returnGeometry: "true",
      geometryPrecision: "5",
      f: "json",
    });

  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    if (token !== identifyToken) return; // superseded by a newer hover

    const result = data && data.results && data.results[0];
    const geom = result && esriPolygonToGeoJSON(result.geometry);
    if (!result || !geom) {
      clearHighlight();
      setInfo("—", "");
      return;
    }

    const attrs = result.attributes || {};
    const name = formatWardName(attrs);
    const stateAbbr = STATE_FIPS[attrs.STATE] || attrs.STATE || "";
    const pop = attrs.POP100;
    const meta =
      stateAbbr +
      (pop != null && pop !== "" ? ` · pop. ${Number(pop).toLocaleString()}` : "");

    if (highlightLayer) map.removeLayer(highlightLayer);
    highlightLayer = L.geoJSON(geom, { style: highlightStyle }).addTo(map);
    setInfo(name, meta);
  } catch (err) {
    // A single failed hover request is non-fatal; ignore.
  }
}

function clearHighlight() {
  if (highlightLayer) {
    map.removeLayer(highlightLayer);
    highlightLayer = null;
  }
}

function onMouseMove(e) {
  if (map.getZoom() < VTD_MIN_ZOOM) return;
  clearTimeout(identifyTimer);
  identifyTimer = setTimeout(() => identifyAt(e.latlng), 90);
}

function updateHint() {
  if (map.getZoom() < VTD_MIN_ZOOM) {
    setHint("Zoom in to a city or town to load its wards and precincts");
  } else {
    setHint("Hover over any ward / precinct to highlight it");
  }
}

// ---------------------------------------------------------------------------
// Wire up: boundaries + hover are always active; dropdown just reframes the map
// ---------------------------------------------------------------------------
getWardTiles().addTo(map);
map.on("mousemove", onMouseMove);
map.on("mouseout", clearHighlight);
map.on("zoomend", updateHint);
updateHint();

// MA start view (Boston) vs. a US overview.
function applyScope(scope) {
  clearHighlight();
  setInfo("—", "");
  if (scope === "US") {
    map.setView([39.5, -98.35], 4); // continental US; zoom in to load wards
  } else {
    map.setView([42.34, -71.06], 12); // Boston wards & precincts
  }
  updateHint();
}

scopeSelect.addEventListener("change", (e) => applyScope(e.target.value));
