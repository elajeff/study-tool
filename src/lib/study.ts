import { requireAccount } from "./auth";
import { buildCurriculum, type SourceNote, type StudyProfile } from "./curriculum";

export async function loadStudy() {
  const { supabase, user } = await requireAccount();
  const [{ data: profile, error: profileError }, { data: notes, error: notesError }] = await Promise.all([
    supabase.from("study_profiles").select("experience,goals,focus,hours_per_week").eq("user_id", user.id).maybeSingle(),
    supabase.from("notes").select("path,title,body").order("path").limit(1000),
  ]);
  if (profileError || notesError) throw new Error("Could not load your study workspace. Check the database setup.");
  return { supabase, user, profile: profile as StudyProfile | null, ...buildCurriculum((notes ?? []) as SourceNote[], profile as StudyProfile | null) };
}
