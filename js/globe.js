// js/globe.js
// The 3D globe (MapLibre GL, globe projection) and everything drawn on it:
//
//   1. WORLD SHADING   the U.S. lit up, other countries greyed out
//   2. CHILD SHAPES    clickable outlines of every state / every county
//   3. STACK OUTLINES  glowing outlines of the layers of government at a place
//                      (city, county, school district, congressional district...)
//   4. PINS            cities, plus a "you are here" pin
//
// MapLibre v6 is an ES module, imported from the CDN (pin the version; bump on
// purpose). No API keys: basemap = OpenFreeMap, country shapes = MapLibre demo
// tiles, state/county/district shapes = U.S. Census Bureau (data/census.js).

import * as maplibregl from "https://unpkg.com/maplibre-gl@6.15.0/dist/maplibre-gl.mjs";
import { levelByKey } from "../data/levels.js";

// ----- Themes ------------------------------------------------------------------

const COUNTRIES_TILEJSON = "https://demotiles.maplibre.org/tiles/tiles.json";
const ACTIVE_COUNTRIES = ["USA"]; // ISO alpha-3. Everything else is greyed out.

// Atmosphere glow around the globe that fades away as you zoom in.
const ATMOSPHERE = ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0];

const THEMES = {
  night: {
    style: "https://tiles.openfreemap.org/styles/dark",
    background: "#0c1630", // land
    water: "#050a18",
    inactive: "#2b3552",
    inactiveOpacity: 0.92,
    active: "#38bdf8",
    activeOpacity: 0.24,
    outline: "#7dd3fc",
    kidsLine: "rgba(186, 230, 253, 0.5)",
    kidsFill: "rgba(186, 230, 253, 0.05)",
    label: "#e0f2fe",
    halo: "rgba(5, 10, 24, 0.95)",
    sky: { "sky-color": "#1d4ed8", "horizon-color": "#38bdf8", "atmosphere-blend": ATMOSPHERE },
  },
  day: {
    style: "https://tiles.openfreemap.org/styles/bright",
    background: null,
    water: null,
    inactive: "#6b7280",
    inactiveOpacity: 0.8,
    active: "#2563eb",
    activeOpacity: 0.28,
    outline: "#1d4ed8",
    kidsLine: "rgba(30, 58, 138, 0.55)",
    kidsFill: "rgba(37, 99, 235, 0.06)",
    label: "#0f172a",
    halo: "rgba(255, 255, 255, 0.92)",
    sky: { "sky-color": "#60a5fa", "horizon-color": "#bfdbfe", "atmosphere-blend": ATMOSPHERE },
  },
};

// Idle motion on the whole-world view: the globe slowly sways left and right
// around the U.S. (a sine wave: +/-35 degrees of longitude, ~30 s per cycle).
const SWAY_CENTER_LNG = -98;
const SWAY_AMPLITUDE_DEG = 35;
const SWAY_RAD_PER_SEC = (2 * Math.PI) / 30;

const EMPTY_FC = { type: "FeatureCollection", features: [] };

export class Globe {
  /**
   * @param {string} containerId
   * @param {object} handlers
   *   onPlaceClick(node)     a city pin was clicked
   *   onRegionClick(region)  a country was clicked while zoomed out
   *   onShapeClick(shape)    a state / county outline was clicked
   *   onZoom(zoom)           the zoom level changed
   * @param {"night"|"day"} [theme]
   */
  constructor(containerId, handlers = {}, theme = "night") {
    this.handlers = handlers;
    this.theme = theme;
    this._container = document.getElementById(containerId);
    this._markers = [];
    this._spinning = false;
    this._atGlobe = true;
    this._pad = { left: 0, right: 0, bottom: 0 }; // px covered by floating panels
    this._stackShapes = new Map(); // id -> Feature
    this._bounds = new Map(); // stack shape id -> [w, s, e, n]
    this._kids = EMPTY_FC;
    this._reports = EMPTY_FC; // protest reports (signed-in pilot feature)
    this._reportPopup = null;
    this._kidBounds = new Map(); // id -> [w, s, e, n]
    this._focusId = null;
    this._hoverId = null;

    this.map = new maplibregl.Map({
      container: containerId,
      style: THEMES[theme].style,
      center: [SWAY_CENTER_LNG, 30], // start looking at the U.S.
      zoom: this.worldZoom(),
      attributionControl: { compact: true },
      maxPitch: 60,
    });
    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    this._tip = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: "shape-tip",
      offset: 14,
    });

    // Pause the idle sway whenever the user touches the globe.
    for (const evt of ["mousedown", "touchstart", "wheel"]) {
      this.map.on(evt, () => this.stopSpin());
    }

    this.ready = new Promise((resolve) => {
      this.map.on("style.load", () => {
        // setProjection must be called after the style loads.
        this.map.setProjection({ type: "globe" });
        this._applyTheme();
        this._installLayers();
        this._pushData();
        resolve();
      });
    });

    this.map.on("error", (e) => console.warn("Map error:", e?.error?.message || e));
    this.map.on("zoom", () => this.handlers.onZoom?.(this.map.getZoom()));
    this.map.on("click", (e) => this._onMapClick(e));
    this.map.on("mousemove", (e) => this._onMapHover(e));
  }

  // ===== Theme =================================================================

  setTheme(theme) {
    if (theme === this.theme || !THEMES[theme]) return;
    this.theme = theme;
    // setStyle wipes our layers; style.load fires again and re-installs them.
    // diff:false forces a clean reload. With the default "diff", MapLibre patches
    // the old style in place, never fires style.load (so our layers and the
    // globe projection are lost), and can reset the camera.
    this.map.setStyle(THEMES[theme].style, { diff: false });
  }

  _applyTheme() {
    const t = THEMES[this.theme];
    this.map.setSky(t.sky);
    if (t.background && this.map.getLayer("background")) {
      this.map.setPaintProperty("background", "background-color", t.background);
    }
    if (t.water && this.map.getLayer("water")) {
      this.map.setPaintProperty("water", "fill-color", t.water);
    }
    // Runway/taxiway strokes read as thick black scribbles on the dark map.
    for (const layer of this.map.getStyle().layers) {
      if (layer.id.startsWith("aeroway")) {
        this.map.setLayoutProperty(layer.id, "visibility", this.theme === "night" ? "none" : "visible");
      }
    }
    // The night basemap prints foreign regional names ("Sakha (Yakutia)") that
    // just add noise from space; show state/region labels only once zoomed in.
    if (this.map.getLayer("place_state")) {
      this.map.setLayerZoomRange("place_state", 4, 24);
    }
  }

  // ===== Layers ================================================================

  _firstSymbolId() {
    return this.map.getStyle().layers.find((l) => l.type === "symbol")?.id;
  }

  _installLayers() {
    const map = this.map;
    const t = THEMES[this.theme];
    const underWater = map.getLayer("water") ? "water" : undefined;
    const underLabels = this._firstSymbolId();

    // 1. World shading: U.S. lit up, everything else greyed out. Fades out as
    //    you zoom in, since by then you're already inside the U.S.
    map.addSource("regions", { type: "vector", url: COUNTRIES_TILEJSON });
    const isActive = ["in", ["get", "ADM0_A3"], ["literal", ACTIVE_COUNTRIES]];
    const fade = (peak) => [
      "interpolate", ["linear"], ["zoom"], 0, peak, 4.8, peak, 6.8, 0,
    ];
    const region = { source: "regions", "source-layer": "countries" };
    map.addLayer({
      ...region, id: "region-inactive", type: "fill", filter: ["!", isActive],
      paint: { "fill-color": t.inactive, "fill-opacity": fade(t.inactiveOpacity) },
    }, underWater);
    map.addLayer({
      ...region, id: "region-active", type: "fill", filter: isActive,
      paint: { "fill-color": t.active, "fill-opacity": fade(t.activeOpacity) },
    }, underWater);
    map.addLayer({
      ...region, id: "region-active-glow", type: "line", filter: isActive,
      paint: {
        "line-color": t.outline, "line-width": 7, "line-blur": 7,
        "line-opacity": fade(0.55),
      },
    }, underWater);
    map.addLayer({
      ...region, id: "region-active-outline", type: "line", filter: isActive,
      paint: {
        "line-color": t.outline,
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 1.4, 6, 2.6],
        "line-opacity": fade(0.95),
      },
    }, underWater);

    // 2. Clickable child shapes (all states / a state's counties)
    map.addSource("kids", { type: "geojson", data: EMPTY_FC });
    map.addLayer({
      id: "kids-fill", type: "fill", source: "kids",
      paint: { "fill-color": t.kidsFill, "fill-opacity": 1 },
    }, underLabels);
    map.addLayer({
      id: "kids-hover", type: "fill", source: "kids", filter: ["==", ["get", "id"], ""],
      paint: { "fill-color": t.active, "fill-opacity": 0.38 },
    }, underLabels);
    map.addLayer({
      id: "kids-line", type: "line", source: "kids",
      paint: {
        "line-color": t.kidsLine,
        "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 8, 1.4],
      },
    }, underLabels);
    map.addLayer({
      id: "kids-label", type: "symbol", source: "kids",
      layout: {
        "text-field": ["get", "short"],
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 2, 10, 5, 12, 8, 15],
        "text-optional": true,
      },
      paint: { "text-color": t.label, "text-halo-color": t.halo, "text-halo-width": 1.6 },
    });

    // 3. Outlines of the government layers at the current place
    map.addSource("stack", { type: "geojson", data: EMPTY_FC });
    map.addLayer({
      id: "stack-fill", type: "fill", source: "stack",
      paint: { "fill-color": ["get", "color"], "fill-opacity": 0.06 },
    }, underLabels);
    map.addLayer({
      id: "stack-glow", type: "line", source: "stack",
      layout: { "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 6, "line-blur": 5, "line-opacity": 0.15 },
    }, underLabels);
    map.addLayer({
      id: "stack-line", type: "line", source: "stack",
      layout: { "line-join": "round" },
      paint: { "line-color": ["get", "color"], "line-width": 1.4, "line-opacity": 0.75 },
    }, underLabels);
    this._paintHighlight();

    // 4. Protest reports: one dot per report, colored by intensity. The colors
    //    are never the only cue: the popup and the list name the level in words.
    map.addSource("reports", { type: "geojson", data: this._reports });
    const byLevel = ["match", ["get", "intensity"], 1, "#22c55e", 2, "#facc15", 3, "#f97316", 4, "#ef4444", "#94a3b8"];
    map.addLayer({
      id: "reports-halo", type: "circle", source: "reports",
      paint: { "circle-radius": 18, "circle-color": byLevel, "circle-opacity": 0.22, "circle-blur": 0.6 },
    });
    map.addLayer({
      id: "reports-dot", type: "circle", source: "reports",
      paint: {
        "circle-radius": 8, "circle-color": byLevel,
        "circle-stroke-color": "#ffffff", "circle-stroke-width": 2.5,
      },
    });
  }

  // Re-send our data after a style change.
  _pushData() {
    this.map.getSource("kids")?.setData(this._kids);
    this.map.getSource("reports")?.setData(this._reports);
    this._pushStack();
  }

  // ----- Protest reports ---------------------------------------------------------

  /** Replace the report dots. `features` are GeoJSON Points with {id, intensity} properties. */
  setReports(features) {
    this._reports = { type: "FeatureCollection", features: features || [] };
    this.map.getSource("reports")?.setData(this._reports);
    if (!features || !features.length) this.closeReportPopup();
  }

  /** Show a popup at a report; `content` is a DOM node built by the caller. */
  showReportPopup(lngLat, content, onClose) {
    this.closeReportPopup();
    this._reportPopup = new maplibregl.Popup({ closeButton: true, offset: 16, className: "report-popup", maxWidth: "300px" })
      .setLngLat(lngLat)
      .setDOMContent(content)
      .addTo(this.map);
    this._reportPopup.on("close", () => {
      this._reportPopup = null;
      onClose?.();
    });
  }

  closeReportPopup() {
    if (this._reportPopup) {
      const p = this._reportPopup;
      this._reportPopup = null;
      p.remove();
    }
  }

  _reportAt(point) {
    if (!this.map.getLayer("reports-dot")) return null;
    const hit = this.map.queryRenderedFeatures(
      [[point.x - 10, point.y - 10], [point.x + 10, point.y + 10]],
      { layers: ["reports-dot"] }
    )[0];
    return hit || null;
  }

  _pushStack() {
    this.map.getSource("stack")?.setData({
      type: "FeatureCollection",
      features: [...this._stackShapes.values()],
    });
  }

  // Emphasize the focused / hovered outline.
  _paintHighlight() {
    const map = this.map;
    if (!map.getLayer("stack-fill")) return;
    const id = this._hoverId || this._focusId || "";
    const is = ["==", ["get", "id"], id];
    map.setPaintProperty("stack-fill", "fill-opacity", ["case", is, 0.3, 0.05]);
    map.setPaintProperty("stack-glow", "line-width", ["case", is, 14, 6]);
    map.setPaintProperty("stack-glow", "line-opacity", ["case", is, 0.7, 0.14]);
    map.setPaintProperty("stack-line", "line-width", ["case", is, 3.2, 1.3]);
    map.setPaintProperty("stack-line", "line-opacity", ["case", is, 1, 0.65]);
  }

  // ----- Stack outlines (layers of government at the current place) -----------

  /** Remove all stack outlines. */
  clearStack() {
    this._stackShapes.clear();
    this._focusId = null;
    this._hoverId = null;
    this._pushStack();
    this._paintHighlight();
  }

  /** Add (or replace) one layer's outline. */
  addStackShape({ id, color, name, kind, geometry }) {
    if (!geometry) return;
    this._stackShapes.set(id, {
      type: "Feature",
      geometry,
      properties: { id, color, name, kind },
    });
    this._bounds.set(id, bboxOf(geometry));
    this._pushStack();
  }

  setFocus(id) {
    this._focusId = id;
    this._paintHighlight();
  }

  setHover(id) {
    this._hoverId = id;
    this._paintHighlight();
  }

  /** Bounding box [w, s, e, n] of a stack outline we've loaded, if any. */
  boundsOf(id) {
    return this._bounds.get(id) || null;
  }

  // ----- Child shapes (clickable states / counties) ----------------------------

  /** Show clickable outlines (a GeoJSON FeatureCollection) or hide with null. */
  setChildShapes(fc) {
    this._kids = fc || EMPTY_FC;
    this._kidBounds.clear();
    for (const f of this._kids.features) {
      this._kidBounds.set(f.properties.id, bboxOf(f.geometry));
    }
    this.map.getSource("kids")?.setData(this._kids);
    this._setHoverShape(null);
  }

  hasChildShapes() {
    return this._kids.features.length > 0;
  }

  _setHoverShape(id) {
    if (this.map.getLayer("kids-hover")) {
      this.map.setFilter("kids-hover", ["==", ["get", "id"], id || ""]);
    }
  }

  // ----- Map interaction --------------------------------------------------------

  _shapeAt(point) {
    if (!this.map.getLayer("kids-fill")) return null;
    const hit = this.map.queryRenderedFeatures(point, { layers: ["kids-fill"] })[0];
    return hit ? hit.properties : null;
  }

  // Which country is under a screen point (only while the shading is visible).
  _regionAt(point) {
    if (this.map.getZoom() >= 6 || !this.map.getLayer("region-active")) return null;
    const hit = this.map.queryRenderedFeatures(point, {
      layers: ["region-active", "region-inactive"],
    })[0];
    if (!hit) return null;
    return {
      code: hit.properties.ADM0_A3,
      name: hit.properties.NAME,
      active: ACTIVE_COUNTRIES.includes(hit.properties.ADM0_A3),
    };
  }

  _onMapClick(e) {
    const report = this._reportAt(e.point);
    if (report) {
      const [lng, lat] = report.geometry.coordinates;
      this.handlers.onReportClick?.({ id: report.properties.id, lngLat: [lng, lat] });
      return;
    }
    const shape = this._shapeAt(e.point);
    if (shape) {
      this.handlers.onShapeClick?.({
        id: shape.id,
        name: shape.name,
        geoid: shape.geoid,
        bbox: this._kidBounds.get(shape.id) || null,
      });
      return;
    }
    const region = this._regionAt(e.point);
    if (region) this.handlers.onRegionClick?.(region);
  }

  _onMapHover(e) {
    const canvas = this.map.getCanvas();
    if (this._reportAt(e.point)) {
      canvas.style.cursor = "pointer";
      return;
    }
    const shape = this._shapeAt(e.point);
    if (shape) {
      canvas.style.cursor = "pointer";
      this._setHoverShape(shape.id);
      this._tip
        .setLngLat(e.lngLat)
        .setHTML(`<strong></strong><span>Click to open</span>`)
        .addTo(this.map);
      this._tip.getElement().querySelector("strong").textContent = shape.name;
      return;
    }
    this._setHoverShape(null);
    this._tip.remove();
    const region = this._regionAt(e.point);
    canvas.style.cursor = !region ? "" : region.active ? "pointer" : "not-allowed";
  }

  // ===== Idle sway ============================================================
  // (startSpin/stopSpin keep their names; the motion is a sway, not a spin.)

  startSpin() {
    if (this._spinning) return;
    this._spinning = true;
    const startedAt = performance.now();
    const tick = (now) => {
      if (!this._spinning) return;
      // Sway side to side around the U.S. instead of a full spin, so the
      // highlighted country never rotates out of view.
      if (!this.map.isMoving()) {
        const t = (now - startedAt) / 1000;
        const lng = SWAY_CENTER_LNG + SWAY_AMPLITUDE_DEG * Math.sin(t * SWAY_RAD_PER_SEC);
        this.map.jumpTo({ center: [lng, this.map.getCenter().lat] });
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  stopSpin() {
    this._spinning = false;
  }

  // ===== Pins =================================================================

  clearMarkers() {
    for (const m of this._markers) m.remove();
    this._markers = [];
  }

  /**
   * Clickable pins for places that have no outline (cities). Clicking one calls
   * handlers.onPlaceClick(node).
   *
   * Structure matters: MapLibre positions the OUTER element with its own
   * transform, so never style that element's position. The visible pin lives in
   * an inner button sized exactly to the dot, with the label hanging below it,
   * so the dot sits precisely on the coordinate (anchor: center).
   * @param {object[]} nodes
   */
  renderMarkers(nodes) {
    this.clearMarkers();
    // With many pins, show names only on hover so they don't pile up.
    const dense = nodes.length > 10;
    for (const node of nodes) {
      if (!node.center || node.center[0] == null) continue;
      const el = document.createElement("div");
      el.className = dense ? "map-marker map-marker-dense" : "map-marker";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "map-marker-btn";
      btn.title = node.name;
      btn.setAttribute("aria-label", `Go to ${node.name}`);
      btn.innerHTML = `<span class="map-marker-dot"></span><span class="map-marker-label"></span>`;
      btn.querySelector(".map-marker-label").textContent = node.name;
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.handlers.onPlaceClick?.(node);
      });
      el.appendChild(btn);

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat(node.center)
        .addTo(this.map);
      this._markers.push(marker);
    }
  }

  /** A non-clickable "you are here" pin at a coordinate. */
  renderYouPin(lngLat, label) {
    const el = document.createElement("div");
    el.className = "map-marker map-marker-current";
    el.innerHTML = `<div class="map-marker-btn"><span class="map-marker-dot"></span><span class="map-marker-label"></span></div>`;
    el.querySelector(".map-marker-label").textContent = label;
    this._markers.push(
      new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(lngLat).addTo(this.map)
    );
  }

  // ===== Camera ===============================================================

  /**
   * Pixels covered by floating panels (intro on the left, info panel on the
   * right, bottom sheet on phones). Camera moves keep the place in the clear.
   */
  setPadding({ left = 0, right = 0, bottom = 0 } = {}) {
    this._pad = { left, right, bottom };
  }

  /** Jump (no animation) to the whole-world view, honoring panel padding. */
  initWorldView() {
    this.map.jumpTo({
      center: [SWAY_CENTER_LNG, 30],
      zoom: this.worldZoom(),
      padding: { top: 0, bottom: this._pad.bottom, left: this._pad.left, right: this._pad.right },
    });
  }

  // Zoom at which the whole globe fills about 85% of the smaller side of the
  // visible map area. In globe projection the sphere's diameter in px is
  // 512 * 2^zoom / PI, so we solve for zoom.
  worldZoom() {
    const w = (this._container.clientWidth || 800) - this._pad.left - this._pad.right;
    const h = (this._container.clientHeight || 600) - this._pad.bottom;
    const diameter = 0.85 * Math.min(w, h);
    const zoom = Math.log2((diameter * Math.PI) / 512);
    return Math.min(2.8, Math.max(0.8, zoom));
  }

  // Camera padding for a place view: clear of the command bar and panels.
  _padding() {
    return {
      top: 90,
      bottom: 60 + this._pad.bottom,
      left: 30 + this._pad.left,
      right: 30 + this._pad.right,
    };
  }

  /** Smoothly frame a [w, s, e, n] box. */
  frame(bbox, { maxZoom = 13.5, duration = 2000 } = {}) {
    this.stopSpin();
    this._atGlobe = false;
    const [w, s, e, n] = bbox;
    this.map.fitBounds(
      [[w, s], [e, n]],
      // absolutePadding: our padding REPLACES the map's persistent padding.
      // Without it MapLibre subtracts both, and the box can't fit the screen.
      { padding: this._padding(), absolutePadding: true, maxZoom, duration, essential: true }
    );
  }

  /**
   * Fly the camera to a place. Uses its `extent` if we know it, else its zoom,
   * else its level's default.
   * @param {object} node
   */
  flyTo(node) {
    const wantsSpin = node.level === "globe";
    this.stopSpin();

    if (node.extent && !wantsSpin) {
      this.frame(node.extent);
    } else {
      const lvl = levelByKey(node.level);
      const zoom = wantsSpin
        ? this.worldZoom()
        : node.zoom ?? (lvl ? lvl.zoom : this.map.getZoom());
      this.map.flyTo({
        center: node.center,
        zoom,
        padding: wantsSpin
          ? { top: 0, bottom: this._pad.bottom, left: this._pad.left, right: this._pad.right }
          : this._padding(),
        duration: 2400,
        curve: 1.5,
        essential: true,
      });
    }

    // Back at the whole-world view: resume the gentle idle sway once settled.
    this._atGlobe = wantsSpin;
    if (wantsSpin) {
      this.map.once("moveend", () => {
        if (this._atGlobe) this.startSpin();
      });
    }
  }

  resize() {
    this.map.resize();
  }
}

// [west, south, east, north] of a GeoJSON geometry
function bboxOf(geometry) {
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
