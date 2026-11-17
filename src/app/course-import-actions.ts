"use server";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadExportManifest } from "@/lib/export-queries";
import { readCourse, parseCourse } from "@/lib/course";

export async function importCourse(_previous: { error?: string }, form: FormData): Promise<{ error?: string }> {
  const { supabase } = await requireAccount();
  let value;
  try { value = readCourse(String(form.get("course") ?? "")); }
  catch (error) { return { error: error instanceof Error ? error.message : "Invalid course JSON." }; }
  const manifest = await loadExportManifest(supabase, value.export_id);
  if (!manifest) return { error: "This Library snapshot is not saved in your account. Use the export that generated the course." };
  let course;
  try { course = parseCourse(value, manifest).course; }
  catch (error) { return { error: error instanceof Error ? error.message : "Invalid course structure." }; }
  const { data, error } = await supabase.rpc("save_course", { p_course: course });
  if (error) return { error: "Could not save the course. Check migration 011 and retry." };
  redirect(`/courses?id=${data}`);
}
