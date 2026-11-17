import type { SupabaseClient } from "@supabase/supabase-js";
import { loadExportManifest } from "./export-queries.ts";
import { parseCourse } from "./course.ts";

export async function loadCourse(client: SupabaseClient, id: string) {
  if (!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)) return null;
  const { data, error } = await client.from("courses").select("raw_block,export_id").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load the saved course.");
  if (!data) return null;
  const manifest = await loadExportManifest(client, data.export_id);
  if (!manifest) throw new Error("The course's Library snapshot is unavailable.");
  return { ...parseCourse(data.raw_block, manifest), manifest };
}
