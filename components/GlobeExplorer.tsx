"use client";

import { useEffect, useRef } from "react";

/**
 * React wrapper for the MapLibre globe explorer that was built on the
 * User-Interface branch (lib/globe/js/*). That code is framework-agnostic:
 * it looks up a fixed set of element ids, builds the map, and wires up
 * navigation/search/geolocation. We render exactly that DOM contract here,
 * then boot it on mount via the exported initApp() and tear it down on unmount.
 *
 * The globe uses MapLibre, which needs the browser, so this component is
 * client-only and loaded with ssr:false by its parent.
 */
export default function GlobeExplorer() {
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current) return; // guard against React strict-mode double-run
    bootedRef.current = true;

    let destroy: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const [{ initApp }] = await Promise.all([
        import("@/lib/globe/js/app.js"),
        // MapLibre's stylesheet is imported in app/layout via globals, but
        // ensure it is present for the markers/controls.
        import("maplibre-gl/dist/maplibre-gl.css"),
      ]);
      if (cancelled) return;
      destroy = initApp();
    })();

    return () => {
      cancelled = true;
      destroy?.();
      bootedRef.current = false;
    };
  }, []);

  return (
    <div className="globe-explorer">
      {/* Top bar: search + locate + breadcrumbs + browse dropdowns */}
      <div className="globe-controls">
        <form id="searchForm" className="globe-search" role="search" autoComplete="off">
          <input
            id="searchInput"
            type="search"
            className="globe-search-input"
            placeholder="Search a city, county, or state…"
            aria-label="Search for a place"
          />
          <ul id="searchResults" className="globe-search-results" role="listbox" hidden />
          <span id="searchStatus" className="sr-only" aria-live="polite" />
        </form>

        <button id="locateBtn" type="button" className="btn-secondary globe-locate">
          📍 Use my location
        </button>

        <div className="globe-nav">
          <button id="worldBtn" type="button" className="btn-secondary" disabled>
            🌍 World
          </button>
          <button id="upBtn" type="button" className="btn-secondary" disabled>
            ↑ Up
          </button>
          <nav id="breadcrumbs" className="globe-breadcrumbs" aria-label="Location path" />
        </div>

        <div id="browse" className="globe-browse" />
      </div>

      <div className="globe-body">
        {/* The MapLibre container */}
        <div id="map" className="globe-map" aria-label="Interactive globe">
          <div id="mapLegend" className="globe-legend" hidden>
            <span className="legend-swatch legend-active" /> Available (U.S.)
            <span className="legend-swatch legend-inactive" /> Not yet available
          </div>
        </div>

        {/* Side panel: races + events */}
        <aside className="globe-panel">
          <header className="globe-panel-head">
            <h3 id="panelTitle">Welcome to Mapachusetts</h3>
            <span id="panelLevel" className="globe-panel-level" hidden />
          </header>

          <div id="welcome" className="globe-welcome">
            <p>
              Spin the globe and click the United States to start, or search for
              your city or state above. Drill down to see the elections and civic
              events that affect you — right down to your city.
            </p>
            <div className="globe-quickpicks">
              <button type="button" className="btn-secondary" data-jump="usa">
                United States
              </button>
              <button type="button" className="btn-secondary" data-jump="ma">
                Massachusetts
              </button>
            </div>
          </div>

          <div id="panelBody" className="globe-panel-body" hidden>
            <div className="globe-tabs" role="tablist" aria-label="Information">
              <button id="tabRaces" className="globe-tab" role="tab" aria-selected="true">
                Races <span id="racesCount" className="globe-tab-count">0</span>
              </button>
              <button id="tabEvents" className="globe-tab" role="tab" aria-selected="false">
                Events <span id="eventsCount" className="globe-tab-count">0</span>
              </button>
            </div>
            <div id="racesList" className="globe-list" role="tabpanel" />
            <div id="eventsList" className="globe-list" role="tabpanel" hidden />
          </div>

          <p id="status" className="globe-status" role="status" aria-live="polite" hidden />
        </aside>
      </div>
    </div>
  );
}
