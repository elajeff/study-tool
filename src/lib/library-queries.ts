import type { SupabaseClient } from "@supabase/supabase-js";

export type LibrarySource = { id: string; name: string; kind: string; short_code: string };
export type LibraryArtifact = {
  id: string; short_code: string; path: string | null; external_id: string | null;
  current_revision_id: string | null;
};

export async function loadLibrarySources(client: SupabaseClient): Promise<LibrarySource[]> {
  const sources: LibrarySource[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("sources")
      .select("id,name,kind,short_code").order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not load imported sources.");
    sources.push(...data);
    if (data.length < 500) return sources;
  }
}

export async function loadLibraryArtifacts(client: SupabaseClient, sourceId: string): Promise<LibraryArtifact[]> {
  const artifacts: LibraryArtifact[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("source_artifacts")
      .select("id,short_code,path,external_id,current_revision_id").eq("source_id", sourceId)
      .order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not load saved source items.");
    artifacts.push(...data);
    if (data.length < 500) return artifacts;
  }
}
