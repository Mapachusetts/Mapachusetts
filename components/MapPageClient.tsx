"use client";

import { useState, useActionState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createEvent, deleteEvent, type EventResult } from "@/app/map/actions";
import {
  EVENT_TYPE_META,
  type MapEvent,
  type MapEventType,
} from "@/lib/types";

// Leaflet touches `window`, so load the map only in the browser.
const EventMap = dynamic(() => import("@/components/EventMap"), {
  ssr: false,
  loading: () => <div className="event-map event-map-loading">Loading map…</div>,
});

interface Props {
  events: MapEvent[];
  isSignedIn: boolean;
  currentUserId: string | null;
}

const initial: EventResult = {};

export default function MapPageClient({ events, isSignedIn, currentUserId }: Props) {
  const router = useRouter();
  const [reporting, setReporting] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [state, formAction, pending] = useActionState(createEvent, initial);

  // On a successful report, close the form and refresh the event list.
  useEffect(() => {
    if (state.ok) {
      setReporting(false);
      setPin(null);
      router.refresh();
    }
  }, [state.ok, router]);

  async function handleDelete(id: string) {
    const res = await deleteEvent(id);
    if (!res.error) router.refresh();
  }

  return (
    <div className="map-layout">
      <div className="map-main">
        <EventMap events={events} canDrop={reporting} onPick={setPin} />

        <div className="map-toolbar">
          {isSignedIn ? (
            reporting ? (
              <p className="map-hint">
                📌 Click anywhere on the map to drop your pin, then fill out the
                form.
              </p>
            ) : (
              <button className="btn" onClick={() => setReporting(true)}>
                + Report a Live Event
              </button>
            )
          ) : (
            <p className="map-hint">
              <a href="/login" className="auth-link">
                Sign in
              </a>{" "}
              to report a live event in your area.
            </p>
          )}
        </div>
      </div>

      <aside className="map-sidebar">
        {reporting && isSignedIn ? (
          <form action={formAction} className="report-form">
            <h3>Report a Live Event</h3>

            <label className="auth-label" htmlFor="type">
              Event type
            </label>
            <select id="type" name="type" className="auth-input" defaultValue="protest">
              {(Object.keys(EVENT_TYPE_META) as MapEventType[]).map((t) => (
                <option key={t} value={t}>
                  {EVENT_TYPE_META[t].emoji} {EVENT_TYPE_META[t].label}
                </option>
              ))}
            </select>

            <label className="auth-label" htmlFor="title">
              Title
            </label>
            <input
              id="title"
              name="title"
              className="auth-input"
              required
              maxLength={120}
              placeholder="e.g. Rally for climate action at the State House"
            />

            <label className="auth-label" htmlFor="description">
              Description (optional)
            </label>
            <textarea
              id="description"
              name="description"
              className="auth-input"
              rows={3}
              maxLength={500}
              placeholder="What's happening, who's organizing, what to expect…"
            />

            <label className="auth-label" htmlFor="event_time">
              Date &amp; time (optional — leave blank if ongoing now)
            </label>
            <input id="event_time" name="event_time" type="datetime-local" className="auth-input" />

            {/* Hidden coords populated by the map pin */}
            <input type="hidden" name="lat" value={pin?.lat ?? ""} />
            <input type="hidden" name="lng" value={pin?.lng ?? ""} />

            <p className={pin ? "pin-status set" : "pin-status"}>
              {pin
                ? `📍 Pin set at ${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}`
                : "📍 Click the map to set the location"}
            </p>

            {state.error && (
              <p className="auth-error" role="alert">
                {state.error}
              </p>
            )}

            <div className="report-form-actions">
              <button type="submit" className="btn" disabled={pending || !pin}>
                {pending ? "Posting…" : "Post Event"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setReporting(false);
                  setPin(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <h3 className="sidebar-title">
              Live Events in Massachusetts
              <span className="event-count">{events.length}</span>
            </h3>
            {events.length === 0 ? (
              <p className="map-hint">
                No events reported yet. {isSignedIn ? "Be the first!" : "Sign in to add one."}
              </p>
            ) : (
              <ul className="event-list">
                {events.map((ev) => {
                  const meta = EVENT_TYPE_META[ev.type] ?? EVENT_TYPE_META.other;
                  const mine = currentUserId && ev.user_id === currentUserId;
                  return (
                    <li key={ev.id} className="event-list-item">
                      <span
                        className="event-list-type"
                        style={{ color: meta.color }}
                      >
                        {meta.emoji} {meta.label}
                      </span>
                      <strong>{ev.title}</strong>
                      {ev.description && <p>{ev.description}</p>}
                      <span className="event-list-time">
                        {ev.event_time
                          ? new Date(ev.event_time).toLocaleString()
                          : "Happening now / ongoing"}
                      </span>
                      {mine && (
                        <button
                          className="event-delete"
                          onClick={() => handleDelete(ev.id)}
                          aria-label={`Delete ${ev.title}`}
                        >
                          Delete
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
