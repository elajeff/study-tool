"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth";

export async function renameCourse(_previous: string, form: FormData): Promise<string> {
  const name = String(form.get("name") ?? "").trim();
  if (!name || name.length > 160) return "Enter a course name of up to 160 characters.";
  const { supabase } = await requireAccount();
  const { error } = await supabase.from("courses").update({ display_name: name })
    .eq("id", String(form.get("course") ?? "")).select("id").single();
  if (error) return "Could not rename this course.";
  revalidatePath("/courses");
  revalidatePath("/courses/study");
  revalidatePath("/dashboard");
  return "Course renamed.";
}

export async function deleteCourse(_previous: string, form: FormData): Promise<string> {
  if (form.get("confirm") !== "yes") return "Confirm that you want to delete this course.";
  const { supabase, user } = await requireAccount();
  const id = String(form.get("course") ?? "");
  const { error } = await supabase.rpc("delete_course", { p_course_id: id });
  if (error) return "Could not delete this course.";
  const jar = await cookies();
  if (jar.get(`study-course-${user.id}`)?.value === id) jar.delete(`study-course-${user.id}`);
  if (jar.get(`study-position-${user.id}`)?.value.startsWith(`${id}.`)) jar.delete(`study-position-${user.id}`);
  for (const path of ["/courses", "/courses/study", "/dashboard", "/portfolio"]) revalidatePath(path);
  redirect(form.get("from_dashboard") === "yes" ? "/dashboard" : "/courses#saved-courses");
}

export async function saveCourseChat(_previous: string, form: FormData): Promise<string> {
  const { supabase } = await requireAccount();
  const url = String(form.get("url") ?? "").trim().replace(/\/$/, "");
  if (url && !/^https:\/\/chatgpt\.com\/(g\/[a-zA-Z0-9-]{1,160}\/)?c\/[a-zA-Z0-9-]{1,100}$/.test(url))
    return "Use the URL of your ChatGPT conversation.";
  const { error } = await supabase.from("courses").update({ chat_url: url || null })
    .eq("id", String(form.get("course") ?? "")).select("id").single();
  if (error) return "Could not save the conversation link.";
  revalidatePath("/courses");
  revalidatePath("/courses/study");
  return url ? "Conversation link saved." : "Conversation link removed.";
}

export async function markCourseStep(_previous: string, form: FormData): Promise<string> {
  const { supabase } = await requireAccount();
  const courseId = String(form.get("course_id") ?? "");
  const stepId = String(form.get("step_id") ?? "");
  const state = form.get("state");
  if (state !== "studied" && state !== "reopen") return "Invalid study progress change.";

  const { data: step, error: readError } = await supabase.from("course_steps")
    .select("completed_at,course_modules!inner(course_id)")
    .eq("id", stepId).eq("course_modules.course_id", courseId).maybeSingle();
  if (readError || !step) return "Could not find this lesson in the course.";

  const completedAt = state === "studied" ? step.completed_at ?? new Date().toISOString() : null;
  if (completedAt !== step.completed_at) {
    const { error } = await supabase.from("course_steps").update({ completed_at: completedAt })
      .eq("id", stepId).select("id").single();
    if (error) return "Could not save study progress.";
  }

  revalidatePath("/courses");
  revalidatePath("/courses/study");
  revalidatePath("/dashboard");
  return "";
}
