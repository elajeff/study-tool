import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadExportManifest, loadExportRevisions } from "@/lib/export-queries";
import { conversationContextText } from "@/lib/conversation-context";
import { inspectImportText } from "@/lib/import-privacy";
import { buildLibraryFiles, LibraryFileSizeError } from "@/lib/library-files";
import { DigestImporter } from "@/components/DigestImporter";
import { CourseLessonCard } from "@/components/CourseLessonCard";
import { librarySuggestionsPrompt } from "@/lib/library-suggestions";
import { repositoryOriginText } from "@/lib/repository-origin";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { supabase } = await requireAccount();
  const manifest = await loadExportManifest(supabase, (await params).id);
  if (!manifest) notFound();
  const revisions = await loadExportRevisions(supabase, manifest.sources.map(source => source.id), manifest.items.map(item => item.revision_id));
  let files;
  try { files = buildLibraryFiles(manifest, revisions); }
  catch (error) {
    if (!(error instanceof LibraryFileSizeError)) throw error;
    return <><Link className="back-link" href="/library">Back to Library</Link><div className="page-heading"><h1>Library snapshot</h1></div>
      <section className="panel"><p role="alert">{error.message}</p></section></>;
  }
  const characters = files.reduce((total, file) => total + file.text.length, 0);
  const warnings = revisions.flatMap(revision => {
    const check = inspectImportText(revision.content);
    return check.blocked || check.review ? [{ id: manifest.items.find(item => item.revision_id === revision.id)!.id, text: check.blocked ?? check.review }] : [];
  });
  const blocked = files.some(file => !!inspectImportText(file.text).blocked);
  return <>
    <Link className="back-link" href="/library">Back to Library</Link>
    <div className="page-heading"><h1>Library snapshot</h1><p>Collections: {manifest.sources.length} · Items: {manifest.items.length}</p></div>
    <section className="panel"><h2>Export for ChatGPT</h2>
      <form action={`/library/exports/${manifest.export_id}/download`} method="POST">
        <p><button className="button button-dark" disabled={blocked}>Download Study Library</button></p>
      </form>
      {manifest.card && <details><summary>Library card</summary><pre className="library-text">{manifest.card}</pre></details>}
      <p>{characters.toLocaleString()} characters · approximately {Math.ceil(characters / 4).toLocaleString()} tokens (characters ÷ 4; estimate only).</p>
      {files.length === 1
        ? <p>Download study-library.md and upload it to your ChatGPT Project. It includes source text and authoring instructions. No separate instructions file is needed.</p>
        : <><p>Extract study-library.zip and upload all {files.length} Markdown files to the same ChatGPT Project. study-library.md contains instructions, maps and a file index; data files contain the source items.</p>
          <p>Check your account&apos;s file allowance before uploading. Files are bounded by UTF-8 bytes, not a verified model token count.</p>
          <ul>{files.map(file => <li key={file.name}>{file.name} · {Buffer.byteLength(file.text, "utf8").toLocaleString()} bytes</li>)}</ul></>}
      <p>Tell ChatGPT what you want to learn and ask it to follow the authoring instructions. Say <strong>start</strong> in the same chat. Import the returned course file to track your progress.</p>
      <p>Downloading does not upload anything. ChatGPT receives the file when you upload it, under your account and data settings.</p>
      {!!warnings.length && <ul>{warnings.map(warning => <li key={warning.id}>{warning.id}: {warning.text}</li>)}</ul>}
      {blocked && <p>Known credential patterns were found. Sanitize the source and prepare a new snapshot before downloading.</p>}
      <details><summary>View study-library.md</summary><pre className="library-text">{files[0].text}</pre></details>
      <p><Link href="/inbox">Import the returned course</Link></p>
      {manifest.sources.some(source => source.kind === "repository") && <p><Link href={`/portfolio?export=${manifest.export_id}`}>Plan repository courses from this snapshot</Link></p>}
      <details><summary>Find learning directions</summary>
        <p>Ask ChatGPT to inspect relevant source items and suggest five directions before creating a course.</p>
        <CourseLessonCard text={librarySuggestionsPrompt(manifest.export_id)} />
      </details>
      <details><summary>Import source summaries</summary>
        <p>Paste the study-digest block for this snapshot. Summaries are unverified navigation aids; they do not replace source text.</p>
        <DigestImporter exportId={manifest.export_id} />
      </details>
    </section>
    <section className="panel"><p>Saved reference: <code>{manifest.export_id}</code></p>
      <p>This snapshot retains the selected revisions and import context. Later imports do not update it. Original collection omissions remain unknown.</p>
      <ul>{manifest.sources.map(source => <li key={source.id}>{source.short_code} · {source.name} ({source.kind})</li>)}</ul>
      <h2>Saved items</h2>
      {!!manifest.origins?.length && <details><summary>Repository origins and exclusions</summary>
        {manifest.origins.map(origin => <pre className="library-text" key={origin.import_id}>{repositoryOriginText(origin)}</pre>)}
      </details>}
      {manifest.items.length ? <ul>{manifest.items.map(item => <li key={item.id}>
        <Link href={`/sources/revisions/${item.revision_id}`}>{item.id} · {item.path}</Link>
        {item.conversation && <details><summary>Snapshot conversation context</summary><pre className="source-context">{conversationContextText(item.conversation)}</pre></details>}
      </li>)}</ul> : <p>No items in the selected collections.</p>}
      <details><summary>Saved maps</summary>{manifest.maps.map(map => <pre className="library-text" key={map.id}>{map.text}</pre>)}</details>
    </section>
  </>;
}
