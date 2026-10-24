"use client";

import dynamic from "next/dynamic";

// The globe uses MapLibre (needs `window`), so load it only in the browser.
const GlobeExplorer = dynamic(() => import("@/components/GlobeExplorer"), {
  ssr: false,
  loading: () => (
    <div className="globe-explorer globe-loading">Loading the globe…</div>
  ),
});

export default function ExploreClient() {
  return <GlobeExplorer />;
}
