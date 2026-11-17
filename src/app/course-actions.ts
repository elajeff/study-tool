"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth";
import { loadCourse, loadCourseSteps } from "@/lib/course-queries";

export async function markCourseStep(form: FormData) {
  const { supabase } = await requireAccount();
  const courseId = String(form.get("course_id") ?? ""), stepId = String(form.get("step_id") ?? "");
  const state = form.get("state");
  if (state !== "studied" && state !== "reopen") throw new Error("Invalid study progress change.");
  if (!await loadCourse(supabase, courseId)) throw new Error("Course not found in your account.");
  const steps = await loadCourseSteps(supabase, courseId);
  const step = steps.find(item => item.row_id === stepId);
  if (!step) throw new Error("Lesson step not found in this course.");
  const completedAt = state === "studied" ? step.completed_at ?? new Date().toISOString() : null;
  const { data, error } = await supabase.from("course_steps").update({ completed_at: completedAt })
    .eq("id", stepId).select("id").single();
  if (error || !data) throw new Error("Could not save study progress.");
  revalidatePath("/courses");
  redirect(`/courses?${new URLSearchParams({ id: courseId, module: step.module_key, step: stepId })}#lesson-focus`);
}
