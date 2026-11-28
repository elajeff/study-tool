import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceAlias } from "./notes.ts";
import type { RepositoryFile } from "./repository-import.ts";

export async function loadRepositoryGitHubUrl(supabase: SupabaseClient, sourceId: string): Promise<string | null> {
  const { data, error } = await supabase.from("source_imports").select("url:repository_origin->>url")
    .eq("source_id", sourceId).eq("repository_origin->>kind", "github")
    .order("accepted_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error("Could not check the saved repository URL.");
  return typeof data?.url === "string" ? data.url : null;
}

export async function loadRepositoryFiles(supabase: SupabaseClient, sourceId: string): Promise<RepositoryFile[]> {
  const files: RepositoryFile[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("source_artifacts")
      .select("id,path,current_revision_id,revision:source_revisions!artifact_current_revision_fk(content_hash)")
      .eq("source_id", sourceId).order("id").range(offset, offset + 499);
    if (error) throw new Error("Could not load repository files.");
    for (const row of data) {
      const revision = row.revision as unknown as { content_hash: string } | null;
      files.push({ artifact_id: row.id, path: row.path, revision_id: row.current_revision_id, content_hash: revision?.content_hash ?? null });
    }
    if (data.length < 500) return files;
  }
}

export async function loadSourceAliases(supabase: SupabaseClient, sourceId?: string | null): Promise<SourceAlias[]> {
  if (sourceId === null) return [];
  const aliases: SourceAlias[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from("source_path_aliases").select("source_id,artifact_id,path,current_path,current_revision_id");
    if (sourceId !== undefined) query = query.eq("source_id", sourceId);
    const { data, error } = await query.order("source_id").order("artifact_id").order("path").range(offset, offset + 499);
    if (error) throw new Error("Could not load source references. Check that migration 005 was applied.");
    aliases.push(...data as SourceAlias[]);
    if (data.length < 500) return aliases;
  }
}

export type SourceRevision = {
  id: string; source_id: string; artifact_id: string; content: string; import_id: string;
  path: string | null; current_path: string | null; current_revision_id: string | null;
  source: { name: string; kind: string };
};

export async function loadSourceRevision(supabase: SupabaseClient, id: string | null): Promise<SourceRevision | null> {
  if (!id || !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(id)) return null;
  const { data: revision, error } = await supabase.from("source_revisions")
    .select("id,source_id,artifact_id,content,import_id").eq("id", id).maybeSingle();
  if (error) throw new Error("Could not load source text.");
  if (!revision) return null;
  const [{ data: artifact, error: artifactError }, { data: item, error: itemError }] = await Promise.all([
    supabase.from("source_artifacts").select("path,current_revision_id,source:sources(name,kind)").eq("id", revision.artifact_id).single(),
    supabase.from("source_import_items").select("path").eq("import_id", revision.import_id).eq("artifact_id", revision.artifact_id).single(),
  ]);
  if (artifactError || itemError) throw new Error("Could not load source provenance.");
  return { ...revision, path: item.path, current_path: artifact.path, current_revision_id: artifact.current_revision_id,
    source: artifact.source as unknown as SourceRevision["source"] };
}
