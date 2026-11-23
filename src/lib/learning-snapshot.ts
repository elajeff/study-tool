import type { SupabaseClient } from "@supabase/supabase-js";
import type { LearningSnapshot } from "./library-card.ts";
import { loadAssessments } from "./assessment-queries.ts";
import { latestApproved } from "./progress.ts";

export async function loadLearningSnapshot(client: SupabaseClient): Promise<LearningSnapshot> {
  const approved = [...latestApproved(await loadAssessments(client, "approved")).values()]
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .map(item => ({ label: item.topic.startsWith("course-step:") ? item.task : item.topic, level: item.level, date: item.date }));
  const courses: LearningSnapshot["courses"] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("courses").select("display_name,title:raw_block->>title").order("created_at", { ascending: false }).order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not load course activity.");
    for (const course of data) courses.push(course.display_name ?? (course.title || "Untitled course"));
    // The card reports saved outlines; per-step progress remains in the Courses screen.
    if (data.length < 500) break;
  }
  return { approved, courses };
}
