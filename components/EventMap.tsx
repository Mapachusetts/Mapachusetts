"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, LayerGroup } from "leaflet";
import { EVENT_TYPE_META, type MapEvent } from "@/lib/types";

// Massachusetts bounding box + center.
const MA_CENTER: [number, number] = [42.17, -71.6];
const MA_BOUNDS: [[number, number], [number, number]] = [
  [41.1, -73.6], // SW
  [42.95, -69.8], // NE
];

interface Props {
  events: MapEvent[];
  /** When true, clicking the map drops/moves a pin and reports its coords. */
  canDrop: boolean;
  /** Called with the dropped pin's coordinates (or null when cleared). */
  onPick?: (coords: { lat: number; lng: number } | null) => void;
}

export default function EventMap({ events, canDrop, onPick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const eventLayerRef = useRef<LayerGroup | null>(null);
  const dropMarkerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);

  // Initialize the map once.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: MA_CENTER,
        zoom: 8,
        minZoom: 7,
        maxBounds: MA_BOUNDS,
        maxBoundsViscosity: 0.8,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      map.fitBounds(MA_BOUNDS);

      eventLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Render event markers whenever the events list changes.
  useEffect(() => {
    if (!ready || !eventLayerRef.current) return;

    (async () => {
      const L = (await import("leaflet")).default;
      const layer = eventLayerRef.current!;
      layer.clearLayers();

      for (const ev of events) {
        const meta = EVENT_TYPE_META[ev.type] ?? EVENT_TYPE_META.other;
        const icon = L.divIcon({
          className: "event-pin",
          html: `<span class="event-pin-dot" style="background:${meta.color}">${meta.emoji}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          popupAnchor: [0, -28],
        });

        const when = ev.event_time
          ? new Date(ev.event_time).toLocaleString()
          : "Happening now / ongoing";

        L.marker([ev.lat, ev.lng], { icon })
          .addTo(layer)
          .bindPopup(
            `<div class="event-popup">
               <span class="event-popup-type" style="color:${meta.color}">${meta.emoji} ${meta.label}</span>
               <strong>${escapeHtml(ev.title)}</strong>
               ${ev.description ? `<p>${escapeHtml(ev.description)}</p>` : ""}
               <span class="event-popup-time">${escapeHtml(when)}</span>
             </div>`
          );
      }
    })();
  }, [events, ready]);

  // Enable / disable click-to-drop-pin.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;

    async function handleClick(e: { latlng: { lat: number; lng: number } }) {
      const L = (await import("leaflet")).default;
      const { lat, lng } = e.latlng;

      if (dropMarkerRef.current) {
        dropMarkerRef.current.setLatLng([lat, lng]);
      } else {
        const icon = L.divIcon({
          className: "event-pin drop-pin",
          html: `<span class="event-pin-dot drop">📌</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
        });
        dropMarkerRef.current = L.marker([lat, lng], { icon, draggable: true }).addTo(map);
        dropMarkerRef.current.on("dragend", () => {
          const pos = dropMarkerRef.current!.getLatLng();
          onPick?.({ lat: pos.lat, lng: pos.lng });
        });
      }
      onPick?.({ lat, lng });
    }

    if (canDrop) {
      map.on("click", handleClick);
      map.getContainer().style.cursor = "crosshair";
    }

    return () => {
      map.off("click", handleClick);
      map.getContainer().style.cursor = "";
    };
  }, [canDrop, ready, onPick]);

  // Clear the drop pin when dropping is turned off.
  useEffect(() => {
    if (!canDrop && dropMarkerRef.current && mapRef.current) {
      dropMarkerRef.current.remove();
      dropMarkerRef.current = null;
    }
  }, [canDrop]);

  return <div ref={containerRef} className="event-map" aria-label="Massachusetts civic events map" />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
