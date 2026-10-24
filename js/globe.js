// js/globe.js
// Wraps MapLibre GL in a real 3D globe and exposes a small API for the rest of
// the app: render markers for a node's children, fly to a node, and report
// clicks back up via callbacks.
//
// MapLibre v6 is distributed as an ES module only, so it is imported from the
// CDN here (pin the version; bump deliberately). No API key is needed: the
// basemap is OpenFreeMap's "bright" vector style.
//
// Why a vector style: it gives crisp labels at every zoom (country, state, city
// names) which helps people who are not used to reading maps.

import * as maplibregl from "https://unpkg.com/maplibre-gl@6.15.0/dist/maplibre-gl.mjs";
import { levelByKey } from "../data/levels.js";

const STYLE_URL = "https://tiles.openfreemap.org/styles/bright";

// Free country polygons (MapLibre demo tiles). Each feature has ADM0_A3 (ISO
// alpha-3 code, e.g. "USA") and NAME.
const COUNTRIES_TILEJSON = "https://demotiles.maplibre.org/tiles/tiles.json";

// Countries that have information in the app. Everything else is greyed out.
const ACTIVE_COUNTRIES = ["USA"];
const ACTIVE_COLOR = "#2563eb";
const ACTIVE_OUTLINE = "#1d4ed8";
const INACTIVE_COLOR = "#6b7280";

// Idle motion on the whole-world view: the globe slowly sways left and right
// around the U.S. (a sine wave: +/-35 degrees of longitude, ~30 s per cycle).
const SWAY_CENTER_LNG = -98;
const SWAY_AMPLITUDE_DEG = 35;
const SWAY_RAD_PER_SEC = (2 * Math.PI) / 30;

export class Globe {
  /**
   * @param {string} containerId - id of the map container element
   * @param {object} handlers - { onPlaceClick(node) }
   */
  constructor(containerId, handlers = {}) {
    this.handlers = handlers;
    this._markers = [];
    this._spinning = false;
    this._atGlobe = true;
    this._container = document.getElementById(containerId);

    this.map = new maplibregl.Map({
      container: containerId,
      style: STYLE_URL,
      center: [SWAY_CENTER_LNG, 30], // start looking at the U.S.
      zoom: this.worldZoom(),
      attributionControl: { compact: true },
      // Keep the camera from tilting past the horizon on mobile
      maxPitch: 60,
    });

    this.map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "bottom-right"
    );

    // Pause the idle sway whenever the user touches the globe.
    for (const evt of ["mousedown", "touchstart", "wheel"]) {
      this.map.on(evt, () => this.stopSpin());
    }

    this.ready = new Promise((resolve) => {
      this.map.on("style.load", () => {
        // setProjection must be called after the style loads.
        this.map.setProjection({ type: "globe" });
        // Atmosphere glow around the globe that fades out as you zoom in.
        this.map.setSky({
          "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 1, 5, 1, 7, 0],
        });
        this._addRegionOverlay();
        resolve();
      });
    });

    // Clicking / hovering a country while zoomed far out.
    this.map.on("click", (e) => {
      const region = this._regionAt(e.point);
      if (region) this.handlers.onRegionClick?.(region);
    });
    this.map.on("mousemove", (e) => {
      const region = this._regionAt(e.point);
      this.map.getCanvas().style.cursor = !region
        ? ""
        : region.active
        ? "pointer"
        : "not-allowed";
    });
    this.map.on("zoom", () => this.handlers.onZoom?.(this.map.getZoom()));

    this.map.on("error", (e) => {
      // Tile/style hiccups shouldn't break the app, but make them visible.
      console.warn("Map error:", e && e.error ? e.error.message : e);
    });
  }

  // ----- Active vs. not-yet-available regions -------------------------------
  //
  // Mapachusetts only has information for the United States right now. The
  // rest of the world stays on the map (so people keep their bearings) but is
  // greyed out, and the U.S. is tinted and outlined. The shading fades away as
  // you zoom in, since by then you are already inside the U.S.
  //
  // To make another country active later, add its ISO 3166-1 alpha-3 code to
  // ACTIVE_COUNTRIES (and give it data in data/places.js).
  _addRegionOverlay() {
    const map = this.map;
    map.addSource("regions", { type: "vector", url: COUNTRIES_TILEJSON });

    const isActive = ["in", ["get", "ADM0_A3"], ["literal", ACTIVE_COUNTRIES]];
    // Full strength when zoomed out, gone by zoom ~7.
    const fade = (peak) => [
      "interpolate", ["linear"], ["zoom"],
      0, peak, 4.8, peak, 6.8, 0,
    ];
    // Insert just under the water layer so the basemap's accurate coastlines
    // and lakes are drawn over these (coarser) country shapes.
    const before = map.getLayer("water") ? "water" : undefined;
    const base = { source: "regions", "source-layer": "countries" };

    map.addLayer(
      {
        ...base,
        id: "region-inactive",
        type: "fill",
        filter: ["!", isActive],
        paint: { "fill-color": INACTIVE_COLOR, "fill-opacity": fade(0.8) },
      },
      before
    );
    map.addLayer(
      {
        ...base,
        id: "region-active",
        type: "fill",
        filter: isActive,
        paint: { "fill-color": ACTIVE_COLOR, "fill-opacity": fade(0.3) },
      },
      before
    );
    map.addLayer(
      {
        ...base,
        id: "region-active-outline",
        type: "line",
        filter: isActive,
        paint: {
          "line-color": ACTIVE_OUTLINE,
          "line-width": ["interpolate", ["linear"], ["zoom"], 0, 1.6, 6, 3.2],
          "line-opacity": fade(0.95),
        },
      },
      before
    );
  }

  // Which country (if any) is under a screen point? Only while zoomed out far
  // enough that the shading is visible.
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

  // Zoom at which the whole globe fills about 85% of the smaller side of the
  // map area. In globe projection the sphere's diameter in px is
  // 512 * 2^zoom / PI, so we solve for zoom.
  worldZoom() {
    const w = this._container.clientWidth || 800;
    const h = this._container.clientHeight || 600;
    const diameter = 0.85 * Math.min(w, h);
    const zoom = Math.log2((diameter * Math.PI) / 512);
    return Math.min(2.8, Math.max(0.8, zoom));
  }

  // ----- Idle sway ---------------------------------------------------------
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

  // ----- Markers -----------------------------------------------------------

  clearMarkers() {
    for (const m of this._markers) m.remove();
    this._markers = [];
  }

  /**
   * Render a clickable marker for each child node. Clicking one calls
   * handlers.onPlaceClick(childNode).
   *
   * Structure matters: MapLibre positions the OUTER element with its own
   * transform, so we never style that element's position. The visible pin lives
   * in an inner element sized exactly to the dot, and the label hangs below it
   * absolutely, so the dot sits precisely on the coordinate (anchor: center).
   * @param {object[]} nodes
   */
  renderMarkers(nodes) {
    this.clearMarkers();
    // With many pins (e.g. 51 states) full names would overlap, so show short
    // codes like "TX" instead. The full name is still the hover text and the
    // screen-reader label, and the basemap prints state names too.
    const dense = nodes.length > 12;
    for (const node of nodes) {
      const el = document.createElement("div");
      el.className = dense ? "map-marker map-marker-dense" : "map-marker";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "map-marker-btn";
      btn.title = node.name;
      btn.setAttribute("aria-label", `Go to ${node.name}`);
      btn.innerHTML = `<span class="map-marker-dot"></span><span class="map-marker-label"></span>`;
      btn.querySelector(".map-marker-label").textContent =
        dense && node.code ? node.code : node.name;
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

  /**
   * A non-clickable "you are here" pin, shown when the current place has no
   * smaller places to drill into (so the view never looks empty).
   * @param {object} node
   */
  renderCurrentPin(node) {
    const el = document.createElement("div");
    el.className = "map-marker map-marker-current";
    el.innerHTML = `<div class="map-marker-btn"><span class="map-marker-dot"></span><span class="map-marker-label"></span></div>`;
    el.querySelector(".map-marker-label").textContent = node.name;
    const marker = new maplibregl.Marker({ element: el, anchor: "center" })
      .setLngLat(node.center)
      .addTo(this.map);
    this._markers.push(marker);
  }

  // ----- Camera ------------------------------------------------------------

  /**
   * Fly the camera to a node. Places found by search carry an `extent`, which
   * we frame; otherwise we use the node's own zoom, then its level's default.
   * @param {object} node
   */
  flyTo(node) {
    const wantsSpin = node.level === "globe";
    this.stopSpin();

    if (node.extent && !wantsSpin) {
      const [w, s, e, n] = node.extent;
      this.map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 60, maxZoom: 13, duration: 2200, essential: true }
      );
    } else {
      const lvl = levelByKey(node.level);
      const zoom = wantsSpin
        ? this.worldZoom()
        : node.zoom ?? (lvl ? lvl.zoom : this.map.getZoom());
      this.map.flyTo({
        center: node.center,
        zoom,
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
