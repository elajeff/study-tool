"use server";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadLibrarySources, loadLibraryArtifacts, loadLatestRepositoryItems, selectLibraryArtifacts } from "@/lib/library-queries";
import { loadExportManifest, loadExportRevisions, loadRepositoryOrigins } from "@/lib/export-queries";
import { loadConversationContexts } from "@/lib/conversation-queries";
import { prepareLibraryExport } from "@/lib/library-pack";
import { parseDigest } from "@/lib/library-digest";
import { revalidatePath } from "next/cache";
import { loadLibraryDigests } from "@/lib/digest-queries";
import { loadLearningSnapshot } from "@/lib/learning-snapshot";

export async function prepareProjectExport(_previous: { error: string } | null, form: FormData): Promise<{ error: string }> {
  const { supabase } = await requireAccount();
  let exportId: string;
  try {
    const selected = new Set(form.getAll("source"));
    const sources = (await loadLibrarySources(supabase)).filter(source => selected.has(source.id));
    if (!sources.length || sources.length !== selected.size) throw new Error("Select owned Library sources.");
    const collections = [];
    for (const source of sources) {
      const [items, latest] = await Promise.all([loadLibraryArtifacts(supabase, source.id),
        source.kind === "repository" ? loadLatestRepositoryItems(supabase, source.id) : null]);
      collections.push({ source, artifacts: selectLibraryArtifacts(items, latest?.items ?? null), repositoryCommit: latest?.commit });
    }
    const ids = collections.flatMap(({ artifacts }) => artifacts.flatMap(item => item.current_revision_id ? [item.current_revision_id] : []));
    const revisions = await loadExportRevisions(supabase, sources.map(source => source.id), ids);
    const repoArtifacts = new Set(collections.filter(({ source }) => source.kind === "repository")
      .flatMap(({ artifacts }) => artifacts.map(item => item.id)));
    const repoImports = new Set(revisions.flatMap(revision =>
      revision.import_id && repoArtifacts.has(revision.artifact_id) ? [revision.import_id] : []));
    const chatIds = collections.filter(({ source }) => ["chatgpt", "claude"].includes(source.kind))
      .flatMap(({ artifacts }) => artifacts.flatMap(item => item.current_revision_id ? [item.current_revision_id] : []));
    const [contexts, digests, learning, origins] = await Promise.all([loadConversationContexts(supabase, chatIds), loadLibraryDigests(supabase, ids),
      form.get("learning") === "include" ? loadLearningSnapshot(supabase) : undefined, loadRepositoryOrigins(supabase, repoImports)]);
    for (const revision of revisions) {
      const origin = revision.import_id && origins.get(revision.import_id);
      if (origin) revision.repository_origin = origin;
    }
    const manifest = prepareLibraryExport(collections, revisions, contexts, digests, learning);
    const { error } = await supabase.rpc("save_library_export", { p_manifest: manifest });
    if (error) throw new Error(`Could not save the Library snapshot: ${error.message}`);
    exportId = manifest.export_id;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not prepare the Library snapshot. Try again." };
  }
  redirect(`/library/exports/${exportId}`);
}

export async function setLibraryItemExclusion(form: FormData) {
  const { supabase } = await requireAccount();
  const { error } = await supabase.from("source_artifacts")
    .update({ exclude_from_library: form.get("exclude") === "yes" })
    .eq("id", String(form.get("item") ?? "")).select("id").single();
  if (error) throw new Error("Could not change the Library selection.");
  revalidatePath("/library");
}

export async function removeLibraryCollection(_previous: string, form: FormData): Promise<string> {
  if (form.get("confirm") !== "yes") return "Confirm removal before continuing.";
  const { supabase } = await requireAccount();
  const { error } = await supabase.rpc("remove_library_source", {
    p_source_id: String(form.get("source_id") ?? ""),
    p_expected_exports: form.getAll("export_id").map(String),
    p_expected_courses: form.getAll("course_id").map(String),
  });
  if (error?.code === "40001") return "The snapshots or courses changed. Reload this page and review the lists again.";
  if (error) return "Could not remove this collection.";
  revalidatePath("/library");
  redirect("/library");
}

export async function importLibraryDigest(_previous: { error?: string; saved?: number } | null, form: FormData): Promise<{ error?: string; saved?: number }> {
  const { supabase } = await requireAccount();
  const manifest = await loadExportManifest(supabase, String(form.get("export_id") ?? ""));
  if (!manifest) return { error: "Library snapshot not found in your account." };
  let digest;
  try { digest = parseDigest(String(form.get("digest") ?? ""), manifest); }
  catch (error) { return { error: error instanceof Error ? error.message : "Invalid digest JSON." }; }
  const { data, error } = await supabase.rpc("save_library_digest", { p_export_id: manifest.export_id, p_items: digest.items });
  if (error) return { error: "Could not save summaries. Check migration 015 and retry." };
  revalidatePath("/library");
  return { saved: data as number };
}
