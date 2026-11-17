"use server";
import { revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/auth";
import { loadStudy } from "@/lib/study";
import { parseInbox } from "@/lib/inbox";
import { prepareInboxImport, type InboxResult } from "@/lib/inbox-import";

export async function importInbox(_previous: { error?: string; results?: InboxResult[]; ignored?: number } | null, form: FormData) {
  const { supabase } = await requireAccount();
  let parsed, prepared;
  try {
    parsed = parseInbox(String(form.get("response") ?? ""));
    const topics = new Set<string>();
    if (parsed.blocks.some(block => block.kind === "evidence" && !block.value.step))
      (await loadStudy()).lessons.forEach(lesson => topics.add(lesson.topic));
    prepared = await prepareInboxImport(supabase, parsed.blocks, topics);
  } catch (error) { return { error: error instanceof Error ? error.message : "Could not validate this response." }; }
  const { data, error } = await supabase.rpc("save_study_inbox", { p_blocks: prepared });
  if (error) return { error: error.code === "23505" ? "A module already has a different saved plan. Nothing from this response was saved."
    : "Nothing from this response was saved. " + error.message };
  for (const path of ["/library", "/courses", "/assessments", "/dashboard"]) revalidatePath(path);
  return { results: data as InboxResult[], ignored: parsed.ignored };
}
