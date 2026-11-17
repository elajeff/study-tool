import type { SupabaseClient } from "@supabase/supabase-js";
import { loadExportManifest } from "./export-queries.ts";
import { parseCourse, type SavedCourseStep } from "./course.ts";

export async function loadCourse(client: SupabaseClient, id: string) {
  if (!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)) return null;
  const { data, error } = await client.from("courses").select("raw_block,export_id").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load the saved course.");
  if (!data) return null;
  const manifest = await loadExportManifest(client, data.export_id);
  if (!manifest) throw new Error("The course's Library snapshot is unavailable.");
  return { ...parseCourse(data.raw_block, manifest), manifest };
}

export async function loadCourseSteps(client: SupabaseClient, courseId: string): Promise<SavedCourseStep[]> {
  const modules = new Map<string, string>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("course_modules").select("id,key").eq("course_id", courseId).order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not load course modules. Check migration 012.");
    data.forEach(row => modules.set(row.id, row.key));
    if (data.length < 500) break;
  }
  const ids = [...modules.keys()], steps: SavedCourseStep[] = [];
  for (let start = 0; start < ids.length; start += 100) {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await client.from("course_steps")
        .select("row_id:id,id:key,module_id,position,kind,goal,sources,done_when,completed_at")
        .in("module_id", ids.slice(start, start + 100)).order("id").range(offset, offset + 499);
      if (error) throw new Error("Could not load saved lesson steps.");
      steps.push(...data.map(({ module_id, ...row }) => ({ ...row, module_key: modules.get(module_id)! })));
      if (data.length < 500) break;
    }
  }
  return steps;
}
