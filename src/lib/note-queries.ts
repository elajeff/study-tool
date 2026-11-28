import type { SupabaseClient } from "@supabase/supabase-js";
import type { Note } from "./notes.ts";

export async function loadNoteList(supabase: SupabaseClient, search: string, page: number) {
  const pageSize = 50;
  const start = (page - 1) * pageSize;
  let query = supabase.from("notes").select("id,path,title,source_id");
  if (search) {
    // Escape regex syntax, then quote the value for PostgREST's OR filter.
    const literal = JSON.stringify(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    query = query.or("path.imatch." + literal + ",title.imatch." + literal);
  }
  const { data, error } = await query.order("id").range(start, start + pageSize);
  if (error) throw new Error("Could not load the note list.");
  return { notes: data.slice(0, pageSize), hasNextPage: data.length > pageSize };
}

export async function loadNotes(supabase: SupabaseClient, sourceId?: string | null): Promise<Note[]> {
  type Row = Omit<Note, "topic" | "source_name"> & { artifact: { legacy_topic: string | null; source: { name: string } } | null };
  const rows = await readNotes<Row>(supabase,
    "id,path,title,body,source_id,artifact_id,artifact:source_artifacts!note_artifact_fk(legacy_topic,source:sources(name))", sourceId);
  return rows.map(({ artifact, ...note }) => ({
    ...note,
    topic: noteTopicKey(note, artifact?.legacy_topic),
    source_name: artifact?.source.name ?? "Manual notes",
  }));
}

function noteTopicKey(note: Pick<Note, "id" | "artifact_id">, legacyTopic?: string | null) {
  return legacyTopic ?? (note.artifact_id ? `source/${note.artifact_id}` : `note/${note.id}`);
}

export async function loadNoteTopicReferences(supabase: SupabaseClient) {
  type Row = Pick<Note, "id" | "source_id" | "artifact_id"> & { artifact: { legacy_topic: string | null } | null };
  const rows = await readNotes<Row>(supabase, "id,source_id,artifact_id,artifact:source_artifacts!note_artifact_fk(legacy_topic)", undefined);
  return rows.map(row => ({ sourceId: row.source_id, topic: noteTopicKey(row, row.artifact?.legacy_topic) }));
}

export function loadNotesForExport(supabase: SupabaseClient, sourceId?: string | null) {
  return readNotes<Pick<Note, "path" | "body" | "source_id">>(supabase, "path,body,source_id", sourceId);
}

async function readNotes<Row>(supabase: SupabaseClient, columns: string, sourceId: string | null | undefined) {
  const notes: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from("notes").select(columns);
    if (sourceId === null) query = query.is("source_id", null);
    else if (sourceId !== undefined) query = query.eq("source_id", sourceId);
    const { data, error } = await query.order("id").range(offset, offset + 499).returns<Row[]>();
    if (error) throw new Error("Could not load your saved notes.");
    notes.push(...data);
    if (data.length < 500) return notes;
  }
}

export type NoteLinkTarget = Pick<Note, "id" | "path" | "artifact_id">;

export async function loadNoteLinkTargets(supabase: SupabaseClient, sourceId: string | null): Promise<NoteLinkTarget[]> {
  const targets: NoteLinkTarget[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from("notes").select("id,path,artifact_id");
    query = sourceId === null ? query.is("source_id", null) : query.eq("source_id", sourceId);
    const { data, error } = await query.order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not load note links.");
    targets.push(...data);
    if (data.length < 500) return targets;
  }
}
