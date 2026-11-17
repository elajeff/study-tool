import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadExportManifest, loadExportRevisions } from "@/lib/export-queries";
import { conversationContextText } from "@/lib/conversation-context";
import { renderLibraryExport } from "@/lib/library-pack";
import { inspectImportText } from "@/lib/import-privacy";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAccount();
  const manifest = await loadExportManifest(supabase, (await params).id);
  if (!manifest) notFound();
  const revisions = await loadExportRevisions(supabase, manifest.sources.map(source => source.id), manifest.items.map(item => item.revision_id));
  const library = renderLibraryExport(manifest, revisions);
  const warnings = revisions.flatMap(revision => {
    const check = inspectImportText(revision.content);
    return check.blocked || check.review ? [{ id: manifest.items.find(item => item.revision_id === revision.id)!.id, text: check.blocked ?? check.review }] : [];
  });
  const blocked = !!inspectImportText(library).blocked;
  return <>
    <Link className="back-link" href="/library">Back to Library</Link>
    <div className="page-heading"><h1>Library snapshot</h1><p>Collections: {manifest.sources.length} · Items: {manifest.items.length}</p></div>
    <section className="panel"><h2>ChatGPT file</h2>
      <p>{library.length.toLocaleString()} characters · approximately {Math.ceil(library.length / 4).toLocaleString()} tokens (characters ÷ 4; estimate only).</p>
      <p>Download study-library.md and upload it to your ChatGPT Project. It includes source text and authoring instructions. No separate instructions file is needed.</p>
      <p>Ask ChatGPT to follow the authoring instructions when creating your course. It chooses relevant material and returns a complete course JSON file, or a JSON block if file creation is unavailable.</p>
      <p>Downloading does not upload anything. ChatGPT receives the file when you upload it, under your account and data settings.</p>
      {!!warnings.length && <ul>{warnings.map(warning => <li key={warning.id}>{warning.id}: {warning.text}</li>)}</ul>}
      <form action={`/library/exports/${manifest.export_id}/download`} method="POST">
        <p><button className="button button-dark" disabled={blocked}>Download Study Library</button></p>
      </form>
      {blocked && <p>Known credential patterns were found. Sanitize the source and prepare a new snapshot before downloading.</p>}
      <details><summary>View exported text</summary><pre className="library-text">{library}</pre></details>
    </section>
    <section className="panel"><p>Saved reference: <code>{manifest.export_id}</code></p>
      <p>This snapshot retains the selected revisions and import context. Later imports do not update it. Original collection omissions remain unknown.</p>
      <ul>{manifest.sources.map(source => <li key={source.id}>{source.short_code} · {source.name} ({source.kind})</li>)}</ul>
      <h2>Saved items</h2>
      {manifest.items.length ? <ul>{manifest.items.map(item => <li key={item.id}>
        <Link href={`/sources/revisions/${item.revision_id}`}>{item.id} · {item.path}</Link>
        {item.conversation && <details><summary>Snapshot conversation context</summary><pre className="source-context">{conversationContextText(item.conversation)}</pre></details>}
      </li>)}</ul> : <p>No items in the selected collections.</p>}
      <details><summary>Saved maps</summary>{manifest.maps.map(map => <pre className="library-text" key={map.id}>{map.text}</pre>)}</details>
    </section>
  </>;
}
