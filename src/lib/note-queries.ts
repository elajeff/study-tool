import type { SupabaseClient } from "@supabase/supabase-js";
import type { Note } from "./notes.ts";

export async function loadNoteList(supabase: SupabaseClient) {
  const notes: Pick<Note, "id" | "path" | "title" | "source_id">[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("notes").select("id,path,title,source_id")
      .order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not load the note list.");
    notes.push(...data);
    if (data.length < 500) return notes;
  }
}

export async function loadNotes(supabase: SupabaseClient, sourceId?: string | null): Promise<Note[]> {
  const notes: Note[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from("notes").select("id,path,title,body,updated_at,source_id,artifact_id,artifact:source_artifacts!note_artifact_fk(legacy_topic,source:sources(name))");
    if (sourceId === null) query = query.is("source_id", null);
    else if (sourceId !== undefined) query = query.eq("source_id", sourceId);
    const { data, error } = await query.order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not load notes. Check that migration 004 was applied.");
    for (const row of data) {
      const { artifact: rawArtifact, ...note } = row;
      const artifact = rawArtifact as unknown as { legacy_topic: string | null; source: { name: string } } | null;
      notes.push({ ...note, topic: artifact?.legacy_topic ?? `${note.artifact_id ? "source" : "note"}/${note.artifact_id ?? note.id}`,
        source_name: artifact?.source.name ?? "Manual notes" });
    }
    if (data.length < 500) return notes;
  }
}
