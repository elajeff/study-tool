import { buildCurriculum, getLesson, noteTopicId, type StudyProfile } from "./curriculum";
import { loadNotes, loadNoteTopicReferences } from "./note-queries";
import { loadSourceAliases } from "./source-queries";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadStudyProfile(supabase: SupabaseClient, userId: string): Promise<StudyProfile | null> {
  const { data, error } = await supabase.from("study_profiles")
    .select("experience,goals,focus,hours_per_week").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Could not load your study profile.");
  return data;
}

export async function loadNoteTopics(supabase: SupabaseClient, sourceId?: string | null) {
  const [notes, aliases] = await Promise.all([loadNotes(supabase, sourceId), loadSourceAliases(supabase, sourceId)]);
  return buildCurriculum(notes, aliases);
}

export async function loadNoteTopic(supabase: SupabaseClient, slug: string) {
  const references = await loadNoteTopicReferences(supabase);
  const reference = references.find(item => noteTopicId(item.topic) === slug);
  if (!reference) return null;
  const { lessons, tracks } = await loadNoteTopics(supabase, reference.sourceId);
  const lesson = getLesson(lessons, slug);
  return lesson ? { lesson, lessons, tracks } : null;
}
