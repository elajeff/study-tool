import { requireAccount } from "./auth";
import { buildCurriculum, type StudyProfile } from "./curriculum";
import { loadNotes } from "./note-queries";
import { loadSourceAliases } from "./source-queries";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function loadStudyProfile(supabase: SupabaseClient, userId: string): Promise<StudyProfile | null> {
  const { data, error } = await supabase.from("study_profiles")
    .select("experience,goals,focus,hours_per_week").eq("user_id", userId).maybeSingle();
  if (error) throw new Error("Could not load your study profile.");
  return data;
}

export async function loadStudy() {
  const { supabase, user } = await requireAccount();
  const profile = await loadStudyProfile(supabase, user.id);
  const [notes, aliases] = await Promise.all([loadNotes(supabase), loadSourceAliases(supabase)]);
  return { supabase, user, profile, ...buildCurriculum(notes, profile, aliases) };
}
