import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadExportManifest } from "@/lib/export-queries";
import { DigestImporter } from "@/components/DigestImporter";
import { CourseLessonCard } from "@/components/CourseLessonCard";
import { librarySuggestionsPrompt } from "@/lib/library-suggestions";
import { libraryDigestPrompt } from "@/lib/library-digest";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAccount();
  const manifest = await loadExportManifest(supabase, (await params).id);
  if (!manifest) notFound();
  const warnings = manifest.items.flatMap(item => item.review ? [{ id: item.id, ...item.review }] : []);
  const blocked = warnings.some(item => item.blocked);
  return <>
    <Link className="back-link" href="/library">Back to Library</Link>
    <div className="page-heading"><h1>Library snapshot</h1><p>Collections: {manifest.sources.length} · Items: {manifest.items.length}</p></div>
    <section className="panel"><h2>Export for ChatGPT</h2>
      <form action={`/library/exports/${manifest.export_id}/download`} method="POST">
        <p><button className="button button-dark" disabled={blocked}>Download Study Library</button></p>
      </form>
      {manifest.card && <details><summary>Library card</summary><pre className="library-text">{manifest.card}</pre></details>}
      <p>Upload study-library.md to your ChatGPT Project. If you get a ZIP for a large snapshot, extract it and upload all the Markdown files together.</p>
      <p>Tell ChatGPT what you want to learn and ask it to follow the authoring instructions. Say <strong>start</strong> in the same chat. Import the returned course file to track your progress.</p>
      <p>Downloading does not upload anything. ChatGPT receives the file when you upload it, under your account and data settings.</p>
      {!!warnings.length && <ul>{warnings.map(warning => <li key={warning.id}>{warning.id}: {warning.blocked ?? warning.review}</li>)}</ul>}
      {blocked && <p>Known credential patterns were found. Sanitize the source and prepare a new snapshot before downloading.</p>}
      <p><Link href="/inbox">Import the returned course</Link></p>
      {manifest.sources.some(source => source.kind === "repository") && <p><Link href={`/portfolio?export=${manifest.export_id}`}>Plan repository courses from this snapshot</Link></p>}
      <details><summary>Find learning directions</summary>
        <p>Ask ChatGPT to inspect relevant source items and suggest five directions before creating a course.</p>
        <CourseLessonCard text={librarySuggestionsPrompt(manifest.export_id)} />
      </details>
      <details><summary>Source summaries (optional)</summary>
        <p>Ask ChatGPT for one-line descriptions to help you browse the Library. Paste the summaries it returns below.</p>
        <CourseLessonCard label="Copy summary request" text={libraryDigestPrompt(manifest.export_id)} />
        <DigestImporter exportId={manifest.export_id} />
      </details>
    </section>
    <section className="panel"><p>Saved reference: <code>{manifest.export_id}</code></p>
      <p>This snapshot retains the selected revisions and import context. Later imports do not update it. Original collection omissions remain unknown.</p>
      <ul>{manifest.sources.map(source => <li key={source.id}>{source.short_code} · {source.name} ({source.kind})</li>)}</ul>
      <h2>Files and conversations in this download</h2>
      {manifest.items.length ? <ul>{manifest.items.map(item => <li key={item.id}>
        <Link prefetch={false} href={`/sources/revisions/${item.revision_id}`}>{item.id} · {item.path}</Link>
      </li>)}</ul> : <p>No items in the selected collections.</p>}
    </section>
  </>;
}
