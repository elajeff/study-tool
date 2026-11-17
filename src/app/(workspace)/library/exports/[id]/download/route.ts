import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadExportManifest, loadExportRevisions } from "@/lib/export-queries";
import { renderLibraryExport } from "@/lib/library-pack";
import { inspectImportText } from "@/lib/import-privacy";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAccount();
  const manifest = await loadExportManifest(supabase, (await params).id);
  if (!manifest) notFound();
  const revisions = await loadExportRevisions(supabase, manifest.sources.map(source => source.id), manifest.items.map(item => item.revision_id));
  const library = renderLibraryExport(manifest, revisions);
  if (inspectImportText(library).blocked) return new Response("Export blocked: known credential patterns found.", { status: 400 });
  return new Response(library, { headers: { "Content-Type": "text/markdown; charset=utf-8",
    "Content-Disposition": 'attachment; filename="study-library.md"', "Cache-Control": "no-store" } });
}
