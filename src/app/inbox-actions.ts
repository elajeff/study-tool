"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadStudy } from "@/lib/study";
import { parseInbox } from "@/lib/inbox";
import { prepareInboxImport, type InboxResult } from "@/lib/inbox-import";

export async function importInbox(_previous: { error?: string; results?: InboxResult[]; ignored?: number } | null, form: FormData) {
  const { supabase } = await requireAccount();
  const file = form.get("response_file");
  const sourceName = file instanceof File ? file.name : "Pasted response";
  let parsed, prepared;
  try {
    if (file instanceof File && file.size > 1024 * 1024) throw new Error("Import at most 1 MiB of response text.");
    const courseId = String(form.get("course_id") ?? ""), moduleId = String(form.get("module") ?? "");
    const moduleIds = form.getAll("batch_module").map(String);
    if (moduleIds.length && (!courseId || moduleId || moduleIds.length < 2 || moduleIds.length > 5 || new Set(moduleIds).size !== moduleIds.length))
      throw new Error("Select 2 to 5 different modules from the course.");
    if (!moduleIds.length && !!courseId !== !!moduleId) throw new Error("Supply both the course and module for a scoped import.");
    const scope = moduleIds.length ? { courseId, moduleIds } : courseId ? { courseId, moduleId } : undefined;
    parsed = parseInbox(file instanceof File ? await file.text() : String(form.get("response") ?? ""), scope);
    const topics = new Set<string>();
    if (parsed.blocks.some(block => block.kind === "evidence" && !block.value.step))
      (await loadStudy()).lessons.forEach(lesson => topics.add(lesson.topic));
    prepared = await prepareInboxImport(supabase, parsed.blocks, topics);
  } catch (error) { return { error: `${sourceName}: ${error instanceof Error ? error.message : "Could not validate this response."} Nothing from this response was saved.` }; }
  const { data, error } = await supabase.rpc("save_study_inbox", { p_blocks: prepared });
  if (error) return { error: error.code === "23505" ? "A module already has a different saved plan. Nothing from this response was saved."
    : "Nothing from this response was saved. " + error.message };
  for (const path of ["/library", "/courses", "/assessments", "/dashboard"]) revalidatePath(path);
  if (form.get("open_course") === "true") {
    const saved = (data as InboxResult[]).find(result => result.kind === "course" || result.kind === "module");
    if (saved && "course_id" in saved) {
      const query = new URLSearchParams({ id: saved.course_id });
      const savedModule = prepared.find(block => block.kind === "module" && block.course_id === saved.course_id);
      if (savedModule?.kind === "module") query.set("module", savedModule.plan.module);
      redirect(`/courses?${query}#${savedModule ? "lesson-focus" : "course-path"}`);
    }
  }
  const results = (data as InboxResult[]).map((result, index) => {
    const block = prepared[index];
    return result.kind === "module" && block.kind === "module" ? { ...result, module: block.plan.module } : result;
  });
  return { results, ignored: parsed.ignored };
}
