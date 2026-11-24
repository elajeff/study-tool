"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { cleanNotePath, titleFromPath } from "@/lib/notes";

export async function createNote(formData: FormData) {
  const { supabase, user } = await requireAccount();
  const path = cleanNotePath(String(formData.get("path") ?? ""));
  const body = String(formData.get("body") ?? "");
  if (!path || body.length > 500000) throw new Error("Invalid note path or size.");
  const { error } = await supabase.from("notes").insert({
    user_id: user.id,
    path,
    title: titleFromPath(path),
    body,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.code === "23505" ? "A manual note already has that path." : "Could not save your note.");
  revalidatePath("/notes");
  redirect("/notes");
}

export async function updateNote(formData: FormData): Promise<{ error: string } | { updatedAt: string }> {
  const { supabase, user } = await requireAccount();
  const id = String(formData.get("id") ?? "");
  const body = String(formData.get("body") ?? "");
  if (!/^[a-f\d-]{36}$/i.test(id) || body.length > 500000) return { error: "Invalid note." };
  const { data, error } = await supabase.from("notes")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", id).eq("user_id", user.id).eq("updated_at", String(formData.get("updated_at") ?? ""))
    .select("updated_at").maybeSingle();
  if (error) return { error: "Could not save this note. Your text is kept here." };
  if (!data) return { error: "This note changed or is no longer available. Copy your text before reloading." };
  revalidatePath("/notes");
  revalidatePath(`/notes/${id}`);
  return { updatedAt: data.updated_at as string };
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

export async function signOut(): Promise<string> {
  const { supabase } = await requireAccount();
  const { error } = await supabase.auth.signOut();
  if (error) return "Could not sign out. Try again before leaving this device.";
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
