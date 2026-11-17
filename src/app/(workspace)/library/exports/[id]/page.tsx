import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadExportManifest } from "@/lib/export-queries";
import { conversationContextText } from "@/lib/conversation-context";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAccount();
  const manifest = await loadExportManifest(supabase, (await params).id);
  if (!manifest) notFound();
  return <>
    <Link className="back-link" href="/library">Back to Library</Link>
    <div className="page-heading"><h1>Library snapshot</h1><p>Collections: {manifest.sources.length} · Items: {manifest.items.length}</p></div>
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
