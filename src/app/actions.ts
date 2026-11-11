"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadStudy } from "@/lib/study";
import { cleanNotePath, titleFromPath } from "@/lib/notes";
import { topicPath } from "@/lib/curriculum";
import { parseEvidence, evidenceFingerprint } from "@/lib/assessments";

export async function importAssessments(formData: FormData) {
  const { supabase, user, lessons } = await loadStudy();
  const text = String(formData.get("evidenceText") ?? "");
  const entries = parseEvidence(text);
  const topics = new Set(lessons.map((lesson) => topicPath(lesson.sourcePath)));
  for (const entry of entries) {
    if (!topics.has(entry.topic)) throw new Error(`Unknown topic: ${entry.topic}`);
  }
  const rows = entries.map((entry) => ({
    ...entry,
    fingerprint: evidenceFingerprint(entry),
    user_id: user.id,
    status: "pending",
  }));
  const { error } = await supabase.from("assessment_receipts")
    .upsert(rows, { onConflict: "user_id,fingerprint", ignoreDuplicates: true });
  if (error) throw new Error("Could not import the assessment. Check that the database migration was applied.");
  revalidatePath("/assessments");
  revalidatePath("/dashboard");
  redirect("/assessments");
}

export async function reviewAssessment(formData: FormData) {
  const { supabase, user } = await requireAccount();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("decision") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["approved", "rejected"].includes(status))
    throw new Error("Invalid review decision.");
  const { data, error } = await supabase.from("assessment_receipts")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id).eq("status", "pending")
    .select("id").maybeSingle();
  if (error || !data) throw new Error("This assessment is no longer pending.");
  revalidatePath("/assessments");
  revalidatePath("/curriculum");
  revalidatePath("/dashboard");
}

export async function createNote(formData: FormData) {
  const { supabase, user } = await requireAccount();
  const path = cleanNotePath(String(formData.get("path") ?? ""));
  const body = String(formData.get("body") ?? "");
  if (!path || body.length > 500000) throw new Error("Invalid note path or size.");
  const { error } = await supabase.from("notes").upsert({
    user_id: user.id,
    path,
    title: titleFromPath(path),
    body,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,path" });
  if (error) throw new Error("Could not save your note.");
  revalidatePath("/notes");
  redirect("/notes");
}

export async function updateNote(formData: FormData) {
  const { supabase, user } = await requireAccount();
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "");
  if (!/^[a-f\d-]{36}$/i.test(id) || body.length > 500000) throw new Error("Invalid note.");
  const { error } = await supabase.from("notes")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id);
  if (error) throw new Error("Could not update your note.");
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
}

export async function removeNote(formData: FormData) {
  const { supabase, user } = await requireAccount();
  const id = String(formData.get("id") ?? "");
  if (!/^[a-f\d-]{36}$/i.test(id)) throw new Error("Invalid note.");
  const { error } = await supabase.from("notes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error("Could not remove the note.");
  revalidatePath("/notes");
  redirect("/notes");
}

export async function signOut() {
  const { supabase } = await requireAccount();
  await supabase.auth.signOut();
  redirect("/");
}

export async function saveStudyProfile(formData: FormData) {
  const { supabase, user } = await requireAccount();
  const experience = String(formData.get("experience") ?? "").trim();
  const goals = String(formData.get("goals") ?? "").trim();
  const focus = String(formData.get("focus") ?? "").trim();
  const hours = Number(formData.get("hours") ?? 5);
  if (!experience || experience.length > 500 || !goals || goals.length > 2000
    || focus.length > 500 || !Number.isInteger(hours) || hours < 1 || hours > 80) {
    throw new Error("Please check your goals and experience details.");
  }
  const { error } = await supabase.from("study_profiles").upsert({
    user_id: user.id, experience, goals, focus, hours_per_week: hours,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw new Error("Could not save your study preferences.");
  revalidatePath("/dashboard");
  revalidatePath("/curriculum");
  revalidatePath("/settings");
  redirect("/dashboard");
}
