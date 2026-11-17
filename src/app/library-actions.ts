"use server";
import { redirect } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadLibrarySources, loadLibraryArtifacts } from "@/lib/library-queries";
import { loadExportRevisions } from "@/lib/export-queries";
import { loadConversationContexts } from "@/lib/conversation-queries";
import { prepareLibraryExport } from "@/lib/library-pack";

export async function prepareProjectExport(form: FormData) {
  const { supabase } = await requireAccount();
  const selected = new Set(form.getAll("source"));
  const sources = (await loadLibrarySources(supabase)).filter(source => selected.has(source.id));
  if (!sources.length || sources.length !== selected.size) throw new Error("Select owned Library sources.");
  const collections = [];
  for (const source of sources) collections.push({ source, artifacts: await loadLibraryArtifacts(supabase, source.id) });
  const ids = collections.flatMap(({ artifacts }) => artifacts.flatMap(item => item.current_revision_id ? [item.current_revision_id] : []));
  const revisions = await loadExportRevisions(supabase, sources.map(source => source.id), ids);
  const chatIds = collections.filter(({ source }) => ["chatgpt", "claude"].includes(source.kind))
    .flatMap(({ artifacts }) => artifacts.flatMap(item => item.current_revision_id ? [item.current_revision_id] : []));
  const manifest = prepareLibraryExport(collections, revisions, await loadConversationContexts(supabase, chatIds));
  const { error } = await supabase.rpc("save_library_export", { p_manifest: manifest });
  if (error) throw new Error("Could not save the Library snapshot. Check migration 010 and retry.");
  redirect(`/library/exports/${manifest.export_id}`);
}
