import { requireAccount } from "./auth";
import { buildCurriculum, type SourceNote, type StudyProfile } from "./curriculum";

export async function loadStudy() {
  const { supabase, user } = await requireAccount();
  const { data: profile, error: profileError } = await supabase.from("study_profiles")
    .select("experience,goals,focus,hours_per_week").eq("user_id", user.id).maybeSingle();
  if (profileError) throw new Error("Could not load your study profile.");
  const notes: SourceNote[] = [];
  for (let offset = 0; offset < 3000; offset += 500) {
    const { data, error } = await supabase.from("notes").select("path,title,body")
      .order("path").range(offset, offset + 499);
    if (error) throw new Error("Could not load your notes.");
    notes.push(...(data ?? []) as SourceNote[]);
    if (!data || data.length < 500) break;
  }
  return { supabase, user, profile: profile as StudyProfile | null,
    ...buildCurriculum(notes, profile as StudyProfile | null) };
}
