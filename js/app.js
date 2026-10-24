// js/app.js
// Entry point. Wires the data, navigation state machine, globe, search box and
// UI together.
//
// What happens when you land on a place:
//   1. The camera flies there; the info panel slides in.
//   2. We ask the Census Bureau which layers of government cover the exact
//      point (federal, state, congressional district, legislature, county,
//      city, school district, ward...) -> the "layer dock" and ballot sections.
//   3. Each layer's outline is fetched and drawn on the globe, glowing, in its
//      own color. Hover / click a layer to highlight it.
//   4. States and counties are clickable shapes; cities are pins.
//
// Ways to move: click a country/state/county/pin, pick from the menus, search,
// press "Use my location", or go Up / back to the whole world.

import { Navigation } from "./navigation.js";
import { Globe } from "./globe.js";
import { UI } from "./ui.js";
import { SearchBox } from "./search.js";
import { getCurrentPosition } from "./geolocation.js";
import {
  fetchRacesForPlace,
  fetchEventsForPlace,
  fetchStack,
  fetchBoundary,
  fetchChildShapes,
  loadChildren,
  resolveFromPoint,
  resolvePlaceFromGeocode,
  resolvePlaceByCoords,
} from "../data/civic.js";
import { kindMeta } from "../data/kinds.js";

const $ = (id) => document.getElementById(id);
const THEME_KEY = "mapachusetts-theme";

// ----- Setup --------------------------------------------------------------------

let theme = "night";
try {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "day" || saved === "night") theme = saved;
} catch {
  /* private mode: just use the default */
}

const nav = new Navigation();

// Where the exact point came from, for the note under the place name.
let pointSource = null; // "search" | "gps" | null

// The layer dock's state (which layers, which outlines have loaded, which is focused).
const dock = { status: "loading", stack: [], loaded: new Set(), focusId: null };

const globe = new Globe(
  "map",
  {
    // A city pin was clicked.
    onPlaceClick: (node) => nav.descendTo(node),

    // A state / county outline was clicked.
    onShapeClick: async (shape) => {
      let node = nav.current.children.find((c) => c.geoid === shape.geoid);
      if (!node) {
        await loadChildren(nav.current);
        node = nav.current.children.find((c) => c.geoid === shape.geoid);
      }
      if (node) nav.descendTo(node);
    },

    // A country was clicked on the zoomed-out globe: the U.S. opens, anywhere
    // else explains that it isn't available yet.
    onRegionClick: (region) => {
      if (region.active) {
        if (nav.current.level === "globe") nav.jumpTo("usa");
      } else {
        ui.setStatus(
          `${region.name} isn't available yet. Mapachusetts covers the United States for now.`,
          "warn",
          4500
        );
      }
    },

    // The map key is only useful while the shading is visible.
    onZoom: (zoom) => ui.setLegendVisible(zoom < 5.2),
  },
  theme
);

const ui = new UI(
  {
    body: document.body,
    navigator: $("navigator"),
    browse: $("browse"),
    upBtn: $("upBtn"),
    worldBtn: $("worldBtn"),
    themeBtn: $("themeBtn"),
    legend: $("mapLegend"),
    dock: $("dock"),
    panelTitle: $("panelTitle"),
    panelLevel: $("panelLevel"),
    breadcrumbs: $("breadcrumbs"),
    pointNote: $("pointNote"),
    countdown: $("countdown"),
    tabBallot: $("tabBallot"),
    tabEvents: $("tabEvents"),
    ballotCount: $("ballotCount"),
    eventsCount: $("eventsCount"),
    ballotList: $("ballotList"),
    eventsList: $("eventsList"),
    status: $("status"),
  },
  {
    onAscend: () => nav.ascend(),
    onReset: () => nav.reset(),
    onJump: (id) => nav.jumpTo(id),

    onThemeToggle: () => {
      theme = theme === "night" ? "day" : "night";
      ui.setTheme(theme);
      globe.setTheme(theme);
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch {
        /* ignore */
      }
    },

    // Dock chip: highlight that layer, show its ballot section, zoom to it.
    onFocusLayer: (id) => focusLayer(id, { frame: true }),
    // Opened a ballot section: just highlight that layer on the globe.
    onSelectLayer: (id) => focusLayer(id),
    onHoverLayer: (id) => globe.setHover(id),
  }
);
ui.setTheme(theme);
ui.showTab("ballot");

const search = new SearchBox(
  {
    form: $("searchForm"),
    input: $("searchInput"),
    list: $("searchResults"),
    status: $("searchStatus"),
  },
  { onSelect: (desc) => goToDescriptor(desc) }
);

// ----- Layout: keep the place clear of the floating panels ----------------------

const wide = () => window.matchMedia("(min-width: 901px)").matches;

function applyPadding() {
  const world = nav.current.level === "globe";
  if (wide()) {
    // Desktop: intro on the left in the world view, dossier on the right otherwise.
    // (When the Browse panel is open it covers the left edge too.)
    const browseOpen = $("navigator").open;
    globe.setPadding(
      world
        ? { left: 520, right: 0, bottom: 0 }
        : { left: browseOpen ? 372 : 0, right: 480, bottom: 120 }
    );
  } else {
    globe.setPadding({ left: 0, right: 0, bottom: world ? 330 : Math.round(window.innerHeight * 0.56) });
  }
}

// ----- Focusing a layer ------------------------------------------------------------

function focusLayer(id, { frame = false } = {}) {
  dock.focusId = id;
  globe.setFocus(id);
  ui.renderDock(dock);
  if (id && frame) {
    // Only when the person asked for it: open that layer's ballot section and
    // zoom the globe to its outline.
    ui.revealLayer(id);
    const b = globe.boundsOf(id);
    if (b) globe.frame(b);
  }
}

// The layer of government a place level corresponds to.
const levelKind = (level, unincorporated) =>
  level === "country" ? "country"
  : level === "state" ? "state"
  : level === "county" ? "county"
  : unincorporated ? "county" : "city";

// Which layer is "the place we're on" (so it starts highlighted).
function primaryId(stack, level) {
  const want = { state: "state", county: "county", city: "city", district: "city" }[level];
  const j =
    stack.find((x) => x.kind === want) ||
    stack.find((x) => x.kind === "county") ||
    stack.find((x) => x.kind === "state");
  return j ? j.id : null;
}

function pointNote(state) {
  const { current, pointIsExact } = state;
  if (current.level === "city" || current.level === "district") {
    if (pointSource === "gps" && pointIsExact) return "Districts shown are for your location.";
    if (pointIsExact) return "Districts shown are for the spot you searched.";
    return `Districts shown are for the center of ${current.name}. Large cities can be split across several districts, so use your location or search an exact spot to see yours.`;
  }
  return "";
}

// ----- Render on every navigation change --------------------------------------------

let renderSeq = 0;
let firstRender = true;

nav.subscribe(async (state) => {
  const seq = ++renderSeq;
  const stale = () => seq !== renderSeq;
  const { current, path } = state;
  const isWorld = current.level === "globe";

  // Reset everything that belongs to the previous place.
  dock.status = "loading";
  dock.stack = [];
  dock.loaded = new Set();
  dock.focusId = null;
  globe.clearStack();
  globe.setChildShapes(null);
  globe.clearMarkers();

  // Kick off loading of county / city lists (for the menus and pins).
  const loads = path.filter((n) => n.level === "state" || n.level === "county").map(loadChildren);
  if (current.level === "country" || current.level === "globe") loads.push(Promise.resolve());

  ui.setMode(isWorld);
  ui.renderBrowse(nav.getState().browse); // shows "Loading…" while lists load
  ui.renderBreadcrumbs(path);
  ui.renderHeader(current);
  ui.renderPointNote(pointNote(state));
  applyPadding();
  if (!isWorld) ui.renderDock(dock);

  // Camera.
  await globe.ready;
  if (stale()) return;
  if (firstRender && isWorld) {
    globe.initWorldView();
    globe.startSpin();
  } else {
    globe.flyTo(current);
  }
  firstRender = false;

  // Pins for the world view; the rest are drawn below once their data arrives.
  if (isWorld) {
    globe.renderMarkers(state.children);
    ui.renderBallot([], { node: current, stack: [], status: "idle" });
    ui.renderEvents([], current);
    return;
  }

  // 1. Events + the sample-data part of the ballot show up straight away.
  fetchEventsForPlace(current.id).then((events) => {
    if (!stale()) ui.renderEvents(events, current);
  });
  fetchRacesForPlace(current.id, []).then((races) => {
    if (!stale()) {
      ui.renderBallot(races, { node: current, stack: [], status: "loading", openKind: levelKind(current.level) });
    }
  });

  // 2. Clickable shapes and pins for the places below this one.
  showChildren(current, loads, seq);

  // 3. The stack of governments at this spot, then their outlines.
  try {
    const res = await fetchStack(state.point, current.level);
    if (stale()) return;
    dock.stack = res.stack;
    ui.renderDock(dock);

    const races = await fetchRacesForPlace(current.id, res.stack);
    if (stale()) return;
    ui.renderBallot(races, {
      node: current,
      stack: res.stack,
      status: "ready",
      openKind: levelKind(current.level, res.unincorporated),
      unincorporated: res.unincorporated,
      unincorporatedName: res.unincorporatedName,
    });

    if (current.level === "city" || current.level === "district") {
      globe.renderYouPin(state.point, state.pointIsExact ? "You are here" : current.name);
    }
    await drawOutlines(res.stack, primaryId(res.stack, current.level), current, seq);
  } catch (err) {
    if (stale()) return;
    console.warn("Could not load layers of government:", err);
    dock.status = "error";
    ui.renderDock(dock);
    ui.setStatus("The Census boundary service didn't answer. Showing the basics only.", "warn", 6000);
  }
});

// Clickable outlines (states / counties) or pins (cities) for the next level down.
async function showChildren(current, loads, seq) {
  const stale = () => seq !== renderSeq;
  const level = current.level;

  if (level === "country" || level === "state") {
    const fc = await fetchChildShapes(current);
    if (stale()) return;
    if (fc && fc.features.length) {
      globe.setChildShapes(fc);
    } else {
      await Promise.all(loads); // outlines unavailable: fall back to pins
      if (!stale()) globe.renderMarkers(current.children);
    }
  } else if (level === "county") {
    await Promise.all(loads);
    if (!stale()) {
      globe.renderMarkers(current.children);
      ui.renderBrowse(nav.getState().browse);
    }
  }

  // Menus: refresh once the lists have arrived.
  await Promise.all(loads);
  if (!stale()) ui.renderBrowse(nav.getState().browse);
}

// Fetch each layer's outline and draw it; frame the camera on the place's own.
async function drawOutlines(stack, primary, current, seq) {
  const stale = () => seq !== renderSeq;
  const todo = stack.filter((j) => j.kind !== "country");
  todo.sort((a, b) => (a.id === primary ? -1 : b.id === primary ? 1 : 0));

  await Promise.all(
    todo.map(async (j) => {
      const geometry = await fetchBoundary(j);
      if (stale()) return;
      if (geometry) {
        globe.addStackShape({
          id: j.id,
          color: kindMeta(j.kind).color,
          name: j.name,
          kind: j.kind,
          geometry,
        });
        dock.loaded.add(j.id);
      }
      if (j.id === primary) {
        focusLayer(j.id);
        const b = globe.boundsOf(j.id);
        // Remember the outline so coming back is instant and well framed.
        if (b && !current.extent && (current.level === "county" || current.level === "city")) {
          current.extent = b;
          globe.frame(b);
        }
      } else {
        ui.renderDock(dock);
      }
    })
  );
  if (stale()) return;
  dock.status = "ready";
  ui.renderDock(dock);
}

// ----- Search ---------------------------------------------------------------------------

async function goToDescriptor(desc) {
  ui.setStatus("Finding the layers of government…", "info");
  const level = desc.type === "state" ? "state" : desc.type === "county" ? "county" : "city";
  // A street-level result is an exact spot; a whole city / county / state is not.
  const exact = !["city", "county", "state"].includes(desc.type);

  try {
    const res = await resolveFromPoint(desc.lng, desc.lat, level);
    if (res.path.length <= 1) throw new Error("not in the U.S.");
    pointSource = "search";
    nav.goToPath(res.path, exact && level === "city" ? [desc.lng, desc.lat] : null);
    const deepest = res.path[res.path.length - 1];
    if (level === "city" && res.unincorporated) {
      ui.setStatus(
        `${desc.name} isn't an incorporated city or town, so we're showing ${deepest.name}.`,
        "info",
        6000
      );
    } else {
      ui.setStatus(`Showing ${deepest.name}.`, "success", 3000);
    }
    return;
  } catch (err) {
    console.warn("Census lookup failed; falling back to the search result's names.", err);
  }

  // Fallback: build the path from the geocoder's names alone.
  const path = await resolvePlaceFromGeocode(desc);
  if (path.length <= 1) {
    ui.setStatus(
      `We found “${desc.name}” but can't place it yet. Try a nearby city or state.`,
      "warn",
      6000
    );
    return;
  }
  pointSource = null;
  nav.goToPath(path);
  ui.setStatus(`Showing ${path[path.length - 1].name}.`, "success", 3000);
}

// ----- Geolocation ------------------------------------------------------------------------

const locateBtn = $("locateBtn");

async function locateMe() {
  locateBtn.disabled = true;
  ui.setStatus("Asking your browser for your location…", "info");
  try {
    const { lng, lat } = await getCurrentPosition();
    ui.setStatus("Finding the governments that cover you…", "info");

    let res = null;
    try {
      res = await resolveFromPoint(lng, lat, "city");
    } catch (err) {
      console.warn("Census lookup failed; using the offline guess.", err);
    }

    if (res && res.path.length <= 1) {
      // The Census service answered, and you're not in the United States.
      ui.setStatus(
        "You appear to be outside the United States. Mapachusetts only covers the U.S. for now, so try searching for a U.S. city or state.",
        "warn",
        8000
      );
      return;
    }

    let path = res ? res.path : await resolvePlaceByCoords(lng, lat); // offline fallback
    if (path.length <= 1) {
      ui.setStatus("We found you, but we don't have details for your area yet. Try the search box.", "warn", 6000);
      return;
    }
    pointSource = res ? "gps" : null;
    nav.goToPath(path, res ? [lng, lat] : null);
    search.setValue("");
    ui.setStatus(`Showing the layers that cover you, in ${path[path.length - 1].name}.`, "success", 4500);
  } catch (err) {
    const msg =
      err && err.code === 1
        ? "Location permission was denied. You can still search for a place or pick one from the lists."
        : err && err.code === 3
        ? "Finding your location took too long. Try again, or search for your city instead."
        : `We couldn't get your location. ${err.message || ""} You can search for a place instead.`;
    ui.setStatus(msg.trim(), "error", 7000);
  } finally {
    locateBtn.disabled = false;
  }
}
locateBtn.addEventListener("click", locateMe);

// ----- Buttons in the intro, keyboard shortcuts ---------------------------------------------

document.addEventListener("click", (e) => {
  const jump = e.target.closest("[data-jump]");
  if (jump) {
    pointSource = null;
    nav.jumpTo(jump.dataset.jump);
    return;
  }
  const action = e.target.closest("[data-action]")?.dataset.action;
  if (action === "locate") locateMe();
  if (action === "search") search.focus();
});

document.addEventListener("keydown", (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
  if ((e.key === "/" && !typing) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
    e.preventDefault();
    search.focus();
  }
});

// Opening / closing the Browse panel changes how much of the map is covered.
$("navigator").addEventListener("toggle", applyPadding);

// Keep the map sized and padded correctly.
window.addEventListener("resize", () => {
  applyPadding();
  globe.resize();
});
