"use server";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadCourse } from "@/lib/course-queries";
import { parseModule } from "@/lib/course";

export async function importModule(_previous: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAccount();
  const courseId = String(form.get("course_id") ?? ""), moduleId = String(form.get("module_id") ?? "");
  const saved = await loadCourse(supabase, courseId);
  if (!saved) return { error: "Course not found in your account." };
  let plan;
  try { plan = parseModule(String(form.get("plan") ?? ""), courseId, saved.course, moduleId, saved.manifest); }
  catch (error) { return { error: error instanceof Error ? error.message : "Invalid module plan." }; }
  const { error } = await supabase.rpc("save_course_module", { p_course_id: courseId, p_plan: plan });
  if (error) return { error: error.message };
  redirect(`/courses?${new URLSearchParams({ id: courseId, module: moduleId })}#module-plan`);
}
