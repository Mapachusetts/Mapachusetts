import { createServerClient } from "@/lib/supabase/server";
import type { Politician } from "@/lib/types";

/** All politicians, alphabetical. The research UI searches them client-side. */
export async function getAllPoliticians(): Promise<Politician[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("politicians")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Politician[];
}
