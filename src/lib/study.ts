import { requireAccount } from "./auth";
import { buildCurriculum, type StudyProfile } from "./curriculum";
import { loadNotes } from "./note-queries";
import { loadSourceAliases } from "./source-queries";

export async function loadStudy() {
  const { supabase, user } = await requireAccount();
  const { data: profile, error: profileError } = await supabase.from("study_profiles")
    .select("experience,goals,focus,hours_per_week").eq("user_id", user.id).maybeSingle();
  if (profileError) throw new Error("Could not load your study profile.");
  const [notes, aliases] = await Promise.all([loadNotes(supabase), loadSourceAliases(supabase)]);
  return { supabase, user, profile: profile as StudyProfile | null,
    ...buildCurriculum(notes, profile as StudyProfile | null, aliases) };
}
