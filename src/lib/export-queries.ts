import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExportManifest, ExportRevision } from "./library-pack.ts";
import type { RepositoryOrigin } from "./repository-origin.ts";

export async function loadExportManifest(client: SupabaseClient, id: string): Promise<ExportManifest | null> {
  if (!/^X[a-f0-9]{64}$/.test(id)) return null;
  const { data, error } = await client.from("library_exports").select("manifest").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load the saved Library snapshot.");
  return (data?.manifest ?? null) as ExportManifest | null;
}

export async function loadExportRevisions(client: SupabaseClient, sourceIds: string[], ids: string[]): Promise<ExportRevision[]> {
  const revisions: ExportRevision[] = [];
  let bytes = 0;
  // UUID filters must also fit HTTP request-line limits.
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await client.from("source_revisions").select("id,artifact_id,content,content_hash,import_id")
      .in("source_id", sourceIds).in("id", ids.slice(offset, offset + 100));
    if (error) throw new Error("Could not load the selected export revisions.");
    for (const row of data) bytes += Buffer.byteLength(row.content, "utf8");
    if (bytes > 35 * 1024 * 1024) throw new Error("The selected sources exceed 35 MiB. Select fewer sources.");
    revisions.push(...data);
  }
  return revisions;
}

export async function loadRepositoryOrigins(client: SupabaseClient, ids: Set<string>) {
  const importIds = [...ids];
  const origins = new Map<string, RepositoryOrigin>();
  for (let offset = 0; offset < importIds.length; offset += 100) {
    const { data, error } = await client.from("source_imports").select("id,repository_origin")
      .in("id", importIds.slice(offset, offset + 100));
    if (error) throw new Error("Could not load repository import details.");
    for (const row of data) {
      if (row.repository_origin) origins.set(row.id, row.repository_origin);
    }
  }
  return origins;
}
