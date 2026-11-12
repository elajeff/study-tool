import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAccount } from "@/lib/auth";
import { loadSourceRevision } from "@/lib/source-queries";

export default async function SourceRevisionPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ line?: string }>;
}) {
  const { supabase } = await requireAccount();
  const { id } = await params;
  const { line: requestedLine } = await searchParams;
  const revision = await loadSourceRevision(supabase, id);
  if (!revision) notFound();
  const lines = revision.content.split(/\r?\n/);
  const line = Math.min(lines.length, Math.max(1, Number.parseInt(requestedLine ?? "1", 10) || 1));
  const start = Math.max(0, line - 4);
  return <>
    <Link className="back-link" href="/notes">Back to notes</Link>
    <div className="page-heading"><h1>Source text</h1><p>{revision.source.name} · {revision.path ?? "Unnamed source"}</p></div>
    <section className="panel markdown-preview">
      {revision.current_revision_id !== revision.id && <p role="status">Historical revision. The current import may contain different connections.</p>}
      {revision.source.kind === "legacy_notes" && <p>Legacy collection. Its initial revisions were migration-time snapshots, not recovered vault originals.</p>}
      <details><summary>Source reference</summary><dl className="source-reference">
        <dt>Source</dt><dd>{revision.source_id}</dd><dt>File</dt><dd>{revision.artifact_id}</dd><dt>Revision</dt><dd>{revision.id}</dd>
        <dt>Current path</dt><dd>{revision.current_path ?? "None"}</dd>
      </dl></details>
      <h2>Line {line}</h2>
      <pre className="source-context">{lines.slice(start, line + 3).map((text, index) => <span id={`L${start + index + 1}`} key={index}
        className={start + index + 1 === line ? "selected-line" : ""}><a href={`?line=${start + index + 1}#L${start + index + 1}`}
          aria-label={`Line ${start + index + 1}`}>{start + index + 1}</a>{text || " "}</span>)}</pre>
      <details><summary>Full source text</summary><pre>{revision.content}</pre></details>
    </section>
  </>;
}
