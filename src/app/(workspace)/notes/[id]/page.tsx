import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { requireAccount } from "@/lib/auth";
import { wikiLinks, findLinkedNote } from "@/lib/notes";
import { loadNotes } from "@/lib/note-queries";
import { removeNote } from "@/app/actions";
import { NoteEditor } from "@/components/NoteEditor";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireAccount();
  const { data: note } = await supabase.from("notes").select("id,path,title,body,updated_at,source_id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!note) notFound();
  const all = await loadNotes(supabase, note.source_id);
  const related = wikiLinks(note.body).map((target) => ({ target, match: findLinkedNote(target, all) }));
  return <><Link href="/notes" className="back-link"><ArrowLeft size={16} /> Back to notes</Link><div className="page-heading"><span className="eyebrow">{note.path}</span><h1>{note.title}</h1></div>
    <div className="notes-grid"><section className="panel"><h2>Edit Markdown</h2><NoteEditor key={note.id} id={note.id} body={note.body} updatedAt={note.updated_at} /><hr className="soft-divider" /><h3>Preview</h3><div className="markdown-preview"><ReactMarkdown skipHtml>{note.body}</ReactMarkdown></div></section>
      <aside><section className="panel"><div className="panel-kicker"><Link2 size={17} /> Linked notes</div>{related.length ? <ul className="related-links">{related.map(({ target, match }) => <li key={target}>{match ? <Link href={`/notes/${match.id}`}>{target}</Link> : <span>{target} <small>(missing or ambiguous in this vault)</small></span>}</li>)}</ul> : <p className="muted small">Use <code>[[Note name]]</code> to link to another note.</p>}</section><section className="panel danger-panel"><h3>Delete note</h3><p className="muted small">Deletes the editable note. Source revisions and assessment history are kept; your vault is unchanged.</p><form action={removeNote}><input type="hidden" name="id" value={note.id} /><button className="button button-danger">Delete note</button></form></section></aside>
    </div>
  </>;
}
