import MapPageClient from "@/components/MapPageClient";
import { createAuthClient, getUser } from "@/lib/supabase/serverAuth";
import type { MapEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getEvents(): Promise<MapEvent[]> {
  try {
    const supabase = await createAuthClient();
    const { data, error } = await supabase
      .from("map_events")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Could not load events:", error.message);
      return [];
    }
    return (data ?? []) as MapEvent[];
  } catch (err) {
    console.error("Supabase not configured for events:", err);
    return [];
  }
}

export default async function MapPage() {
  let user = null;
  try {
    user = await getUser();
  } catch {
    // env not set — show map in read-only mode
  }
  const events = await getEvents();

  return (
    <section className="section map-section">
      <h2>Live Civic Events — Massachusetts</h2>
      <p className="section-subtitle">
        A community-reported map of protests, rallies, town halls, and other
        civic events across Massachusetts. Everyone can browse; signed-in users
        can report new events in real time.
      </p>
      <MapPageClient
        events={events}
        isSignedIn={Boolean(user)}
        currentUserId={user?.id ?? null}
      />
    </section>
  );
}
