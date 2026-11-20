"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth";
import { loadCourse, loadCourseSteps } from "@/lib/course-queries";
import { nextCourseLesson } from "@/lib/course";

export async function saveCourseChat(_previous: string, form: FormData): Promise<string> {
  const { supabase } = await requireAccount();
  const url = String(form.get("url") ?? "").trim().replace(/\/$/, "");
  if (url && !/^https:\/\/chatgpt\.com\/(g\/[a-zA-Z0-9-]{1,160}\/)?c\/[a-zA-Z0-9-]{1,100}$/.test(url))
    return "Use the URL of your ChatGPT conversation.";
  const { error } = await supabase.from("courses").update({ chat_url: url || null })
    .eq("id", String(form.get("course") ?? "")).select("id").single();
  if (error) return "Could not save the conversation link.";
  revalidatePath("/courses");
  return url ? "Conversation link saved." : "Conversation link removed.";
}

export async function markCourseStep(form: FormData) {
  const { supabase } = await requireAccount();
  const courseId = String(form.get("course_id") ?? ""), stepId = String(form.get("step_id") ?? "");
  const state = form.get("state");
  if (state !== "studied" && state !== "reopen") throw new Error("Invalid study progress change.");
  const saved = await loadCourse(supabase, courseId);
  if (!saved) throw new Error("Course not found in your account.");
  const steps = await loadCourseSteps(supabase, courseId);
  const step = steps.find(item => item.row_id === stepId);
  if (!step) throw new Error("Lesson step not found in this course.");
  const completedAt = state === "studied" ? step.completed_at ?? new Date().toISOString() : null;
  const { data, error } = await supabase.from("course_steps").update({ completed_at: completedAt })
    .eq("id", stepId).select("id").single();
  if (error || !data) throw new Error("Could not save study progress.");
  revalidatePath("/courses");
  const next = state === "reopen" ? { module: saved.course.modules.find(item => item.id === step.module_key)!, step }
    : nextCourseLesson(saved.course, steps.map(item => item.row_id === stepId ? { ...item, completed_at: completedAt } : item));
  const query = new URLSearchParams({ id: courseId });
  if (next) { query.set("module", next.module.id); if (next.step) query.set("step", next.step.row_id); }
  redirect(`/courses?${query}#${next?.step ? "lesson-focus" : next ? "module-plan" : "course-path"}`);
}
