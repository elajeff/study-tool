import Link from "next/link";
import { noteRelationships, noteLinkResolver, type SourceAlias } from "@/lib/notes";
import type { NoteLinkTarget } from "@/lib/note-queries";
import type { SourceRevision } from "@/lib/source-queries";

type Target = { path: string; artifact_id: string | null; href: string | null };
const labels = { link: "Link", prerequisite: "Prerequisite", recommendation: "Recommended" };

function Connections({ body, targets, aliases, revisionId }: { body: string; targets: Target[]; aliases: SourceAlias[]; revisionId?: string }) {
  const connections = noteRelationships(body);
  const resolveLink = noteLinkResolver(targets, aliases);
  return connections.length ? <ul className="related-links">{connections.map((connection, index) => {
    const result = resolveLink(connection.target);
    return <li key={index}>
      {result.state === "resolved" && result.note.href ? <Link href={result.note.href}>{connection.target}</Link>
        : <span>{connection.target} <small>({result.state === "resolved" ? "no source text" : result.state} in this vault)</small></span>}
      <small> · {labels[connection.kind]} · {revisionId
        ? <Link href={`/sources/revisions/${revisionId}?line=${connection.line}#L${connection.line}`}>line {connection.line}</Link>
        : `line ${connection.line} in current note`}</small>
    </li>;
  })}</ul> : <p className="muted small">No explicit note links.</p>;
}

export function NoteConnections({ body, notes, aliases, original }: { body: string; notes: NoteLinkTarget[]; aliases: SourceAlias[]; original: SourceRevision | null }) {
  const targets = notes.map((note) => ({ path: note.path, artifact_id: note.artifact_id, href: `/notes/${note.id}` }));
  const originalTargets = [...new Map(aliases.map((alias) => [alias.artifact_id, {
    artifact_id: alias.artifact_id, path: alias.current_path ?? alias.path,
    href: alias.current_revision_id ? `/sources/revisions/${alias.current_revision_id}` : null,
  }])).values()];
  const unchanged = original?.content === body;
  return <section className="panel"><h3>Connections</h3>
    <p className="muted small">Explicit links in {unchanged ? "the saved source text" : "the current note"}.</p>
    <Connections body={body} targets={targets} aliases={aliases} revisionId={unchanged ? original.id : undefined} />
    {original && <>
      <p className="small"><Link href={`/sources/revisions/${original.id}`}>Saved source text</Link> · {original.source.name}</p>
      {!unchanged && <details><summary>Connections in saved source text</summary>
        <p className="muted small">The editable note differs from this source revision.</p>
        <Connections body={original.content} targets={originalTargets} aliases={aliases} revisionId={original.id} />
      </details>}
    </>}
  </section>;
}
