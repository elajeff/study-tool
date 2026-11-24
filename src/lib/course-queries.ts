import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCourse, type SavedCourseStep } from "./course.ts";

export class UnreadableCourseError extends Error {}

export async function loadCourse(client: SupabaseClient, id: string) {
  if (!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)) return null;
  const { data, error } = await client.from("courses").select("raw_block,export_id,chat_url,display_name").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load the saved course.");
  if (!data) return null;
  const { data: snapshot, error: snapshotError } = await client.from("library_exports")
    .select("items:manifest->items").eq("id", data.export_id).returns<{ items: { id: string }[] }[]>().maybeSingle();
  if (snapshotError) throw new Error("Could not load the saved Library snapshot.");
  if (!snapshot) throw new Error("The course's Library snapshot is unavailable.");
  try {
    const parsed = parseCourse(data.raw_block, { export_id: data.export_id, items: snapshot.items });
    return { ...parsed, name: data.display_name ?? parsed.course.title, chatUrl: data.chat_url };
  } catch {
    throw new UnreadableCourseError("This saved outline is invalid. Import a corrected outline or open another course.");
  }
}

export async function loadCourseSteps(client: SupabaseClient, courseId: string): Promise<SavedCourseStep[]> {
  const steps: SavedCourseStep[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("course_steps")
      .select("row_id:id,id:key,position,kind,goal,sources,done_when,completed_at,module:course_modules!inner(key)")
      .eq("module.course_id", courseId).order("id").range(offset, offset + 499)
      .returns<(Omit<SavedCourseStep, "module_key"> & { module: { key: string } })[]>();
    if (error) throw new Error("Could not load saved lesson steps.");
    steps.push(...data.map(({ module, ...step }) => ({ ...step, module_key: module.key })));
    if (data.length < 500) return steps;
  }
}
