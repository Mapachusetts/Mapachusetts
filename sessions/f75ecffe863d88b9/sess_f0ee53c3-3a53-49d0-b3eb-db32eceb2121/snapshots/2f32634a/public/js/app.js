// js/app.js
// Entry point. Wires the data, navigation state machine, globe, search box and
// UI together.
//
// Data flow:
//   - Navigation owns the current position in the hierarchy and emits state.
//   - On every state change we update the dropdowns + breadcrumbs, fly the
//     globe, show the child places as markers, and load races + events.
//   - Ways to move: click a marker (down), pick from a dropdown, type in the
//     search box, press "Use my location", or go Up / back to the whole world.

import { Navigation } from "./navigation.js";
import { Globe } from "./globe.js";
import { UI } from "./ui.js";
import { SearchBox } from "./search.js";
import { getCurrentPosition } from "./geolocation.js";
import { reversePlace } from "./geocode.js";
import {
  fetchRacesForPlace,
  fetchEventsForPlace,
  resolvePlaceFromGeocode,
  resolvePlaceByCoords,
} from "../data/civic.js";

const $ = (id) => document.getElementById(id);

const nav = new Navigation();

const globe = new Globe("map", {
  // Clicking a place marker drills down into it.
  onPlaceClick: (node) => nav.descendTo(node),

  // Clicking a country on the zoomed-out globe: the U.S. opens, anywhere else
  // explains that it isn't available yet.
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
});

const ui = new UI(
  {
    breadcrumbs: $("breadcrumbs"),
    upBtn: $("upBtn"),
    worldBtn: $("worldBtn"),
    browse: $("browse"),
    legend: $("mapLegend"),
    panelTitle: $("panelTitle"),
    panelLevel: $("panelLevel"),
    welcome: $("welcome"),
    panelBody: $("panelBody"),
    tabRaces: $("tabRaces"),
    tabEvents: $("tabEvents"),
    racesCount: $("racesCount"),
    eventsCount: $("eventsCount"),
    racesList: $("racesList"),
    eventsList: $("eventsList"),
    status: $("status"),
  },
  {
    onAscend: () => nav.ascend(),
    onReset: () => nav.reset(),
    onJump: (id) => nav.jumpTo(id),
  }
);

const search = new SearchBox(
  {
    form: $("searchForm"),
    input: $("searchInput"),
    list: $("searchResults"),
    status: $("searchStatus"),
  },
  { onSelect: (desc) => goToDescriptor(desc) }
);

// ----- Render on every navigation change --------------------------------------

let renderSeq = 0;
let firstRender = true;

nav.subscribe(async (state) => {
  const seq = ++renderSeq;
  const { current } = state;

  ui.renderBrowse(state.browse);
  ui.renderBreadcrumbs(state.path);
  ui.renderHeader(current);
  ui.setWelcome(current.level === "globe");

  // Camera + markers.
  await globe.ready;
  if (seq !== renderSeq) return;
  if (firstRender && current.level === "globe") {
    globe.startSpin(); // already looking at the world; just start turning
  } else {
    globe.flyTo(current);
  }
  firstRender = false;
  globe.renderMarkers(state.children);
  if (!state.children.length) globe.renderCurrentPin(current);

  // Races + events for this place (own + inherited from larger areas).
  try {
    const [races, events] = await Promise.all([
      fetchRacesForPlace(current.id),
      fetchEventsForPlace(current.id),
    ]);
    if (seq !== renderSeq) return; // user already moved on
    ui.renderRaces(races, current);
    ui.renderEvents(events, current);
  } catch (err) {
    console.error(err);
    ui.setStatus("Something went wrong loading information for this place.", "error", 6000);
  }
});

ui.showTab("races");

// Deep link: /?place=<id> opens that place, e.g. /?place=us-ma from a
// candidate's profile page. Unknown ids are ignored (jumpTo is a no-op).
const startPlace = new URLSearchParams(window.location.search).get("place");
if (startPlace) nav.jumpTo(startPlace);

// ----- Search ---------------------------------------------------------------------

async function goToDescriptor(desc) {
  const path = await resolvePlaceFromGeocode(desc);
  if (path.length <= 1) {
    ui.setStatus(
      `We found “${desc.name}” but can't place it on the globe yet. Try a nearby city or state.`,
      "warn",
      6000
    );
    return;
  }
  nav.goToPath(path);
  const deepest = path[path.length - 1];
  ui.setStatus(`Showing ${deepest.name}.`, "success", 3500);
}

// ----- Geolocation ------------------------------------------------------------------

const locateBtn = $("locateBtn");

locateBtn.addEventListener("click", async () => {
  locateBtn.disabled = true;
  ui.setStatus("Asking your browser for your location…", "info");
  try {
    const { lng, lat } = await getCurrentPosition();
    ui.setStatus("Finding your area…", "info");

    let path = [];
    try {
      const desc = await reversePlace(lng, lat);
      if (desc && desc.countryCode && desc.countryCode !== "US") {
        // Outside the United States: nothing to show yet.
        ui.setStatus(
          "You appear to be outside the United States. Mapachusetts only covers the U.S. for now, so try searching for a U.S. city or state.",
          "warn",
          8000
        );
        return;
      }
      if (desc) path = await resolvePlaceFromGeocode(desc);
    } catch (err) {
      console.warn("Reverse lookup failed, using offline fallback.", err);
    }
    if (path.length <= 1) path = await resolvePlaceByCoords(lng, lat); // offline fallback

    if (path.length <= 1) {
      ui.setStatus(
        "We found you, but we don't have details for your area yet. Try the search box.",
        "warn",
        6000
      );
    } else {
      nav.goToPath(path);
      search.setValue("");
      ui.setStatus(`Showing ${path[path.length - 1].name}, near you.`, "success", 4000);
    }
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
});

// ----- Quick picks in the welcome card ------------------------------------------------

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-jump]");
  if (btn) nav.jumpTo(btn.dataset.jump);
});

// Keep the map sized correctly.
window.addEventListener("resize", () => globe.resize());
