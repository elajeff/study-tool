import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadExportManifest, loadExportRevisions } from "@/lib/export-queries";
import JSZip from "jszip";
import { buildLibraryFiles, LibraryFileSizeError } from "@/lib/library-files";
import { inspectImportText } from "@/lib/import-privacy";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAccount();
  const manifest = await loadExportManifest(supabase, (await params).id);
  if (!manifest) notFound();
  const revisions = await loadExportRevisions(supabase, manifest.sources.map(source => source.id), manifest.items.map(item => item.revision_id));
  let files;
  try { files = buildLibraryFiles(manifest, revisions); }
  catch (error) {
    if (error instanceof LibraryFileSizeError) return new Response(error.message, { status: 413 });
    throw error;
  }
  if (files.some(file => inspectImportText(file.text).blocked)) return new Response("Export blocked: known credential patterns found.", { status: 400 });
  if (files.length === 1) return new Response(files[0].text, { headers: { "Content-Type": "text/markdown; charset=utf-8",
    "Content-Disposition": 'attachment; filename="study-library.md"', "Cache-Control": "no-store" } });
  const zip = new JSZip();
  for (const file of files) zip.file(file.name, file.text);
  const archive = await zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
  return new Response(new Blob([archive]).stream(), { headers: {
    "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="study-library.zip"', "Cache-Control": "no-store" } });
}
