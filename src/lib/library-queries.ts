import type { SupabaseClient } from "@supabase/supabase-js";

export type LibrarySource = { id: string; name: string; kind: string; short_code: string };
export type LibraryArtifact = {
  id: string; short_code: string; path: string | null; external_id: string | null;
  current_revision_id: string | null;
  exclude_from_library?: boolean;
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
      .select("id,short_code,path,external_id,current_revision_id,exclude_from_library").eq("source_id", sourceId)
      .order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not load saved source items.");
    artifacts.push(...data);
    if (data.length < 500) return artifacts;
  }
}

export async function loadLatestRepositoryItems(client: SupabaseClient, sourceId: string) {
  const { data: run, error } = await client.from("source_imports").select("id,commit:repository_origin->>commit").eq("source_id", sourceId)
    .not("repository_origin", "is", null).order("accepted_at", { ascending: false }).order("id").limit(1).maybeSingle();
  if (error) throw new Error("Could not load the latest repository import.");
  if (!run) return null;

  const items = new Map<string, { revision_id: string; path: string }>();
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from("source_import_items").select("artifact_id,revision_id,path")
      .eq("import_id", run.id).order("artifact_id").range(offset, offset + 499);
    if (error) throw new Error("Could not load files from the latest repository import.");
    for (const { artifact_id, revision_id, path } of data) items.set(artifact_id, { revision_id, path });
    if (data.length < 500) return { items, commit: typeof run.commit === "string" ? run.commit : null };
  }
}

export function selectLibraryArtifacts(artifacts: LibraryArtifact[], latest: ReadonlyMap<string, { revision_id: string; path: string }> | null) {
  return artifacts.flatMap(artifact => {
    if (artifact.exclude_from_library) return [];
    if (!latest) return [artifact];
    const accepted = latest.get(artifact.id);
    return accepted ? [{ ...artifact, path: accepted.path, current_revision_id: accepted.revision_id }] : [];
  });
}
