"use server";

import { revalidatePath } from "next/cache";
import { createAuthClient, getUser } from "@/lib/supabase/serverAuth";
import type { MapEventType } from "@/lib/types";

// Massachusetts bounding box — reports must fall inside it.
const MA_BOUNDS = { minLat: 41.1, maxLat: 42.95, minLng: -73.6, maxLng: -69.8 };

const VALID_TYPES: MapEventType[] = [
  "protest",
  "rally",
  "town-hall",
  "march",
  "vigil",
  "community-meeting",
  "other",
];

export interface EventResult {
  error?: string;
  ok?: boolean;
}

/** Create a new live event. Requires a signed-in user. */
export async function createEvent(
  _prev: EventResult,
  formData: FormData
): Promise<EventResult> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in to report an event." };

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const type = String(formData.get("type") ?? "protest") as MapEventType;
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const eventTimeRaw = String(formData.get("event_time") ?? "").trim();

  if (!title) return { error: "Please give the event a title." };
  if (!VALID_TYPES.includes(type)) return { error: "Invalid event type." };
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { error: "Please drop a pin on the map to set the location." };
  }
  if (
    lat < MA_BOUNDS.minLat ||
    lat > MA_BOUNDS.maxLat ||
    lng < MA_BOUNDS.minLng ||
    lng > MA_BOUNDS.maxLng
  ) {
    return { error: "The pin must be inside Massachusetts." };
  }

  const supabase = await createAuthClient();
  const { error } = await supabase.from("map_events").insert({
    user_id: user.id,
    type,
    title,
    description: description || null,
    lat,
    lng,
    event_time: eventTimeRaw ? new Date(eventTimeRaw).toISOString() : null,
  });

  if (error) return { error: error.message };

  revalidatePath("/map");
  return { ok: true };
}

/** Delete one of the current user's own events. RLS enforces ownership too. */
export async function deleteEvent(id: string): Promise<EventResult> {
  const user = await getUser();
  if (!user) return { error: "You must be signed in." };

  const supabase = await createAuthClient();
  const { error } = await supabase
    .from("map_events")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/map");
  return { ok: true };
}
