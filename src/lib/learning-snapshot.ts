import type { SupabaseClient } from "@supabase/supabase-js";
import type { LearningSnapshot } from "./library-card.ts";

export async function loadLearningSnapshot(client: SupabaseClient): Promise<LearningSnapshot> {
  const { data, count, error } = await client.from("courses")
    .select("display_name,title:raw_block->>title", { count: "exact" })
    .order("created_at", { ascending: false }).order("id").limit(5);
  if (error) throw new Error("Could not load saved courses.");
  return { count: count ?? data.length, courses: data.map(course => course.display_name ?? (course.title || "Untitled course")) };
}
