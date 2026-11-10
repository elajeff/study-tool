import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { requireAccount } from "@/lib/auth";
import { wikiLinks, findLinkedNote, type Note } from "@/lib/notes";
import { updateNote, removeNote } from "@/app/actions";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireAccount();
  const { data: note } = await supabase.from("notes").select("id,path,title,body,updated_at").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!note) notFound();
  const { data: all } = await supabase.from("notes").select("id,path,title").limit(500);
  const related = wikiLinks(note.body).map((target) => ({ target, match: findLinkedNote(target, (all ?? []) as Note[]) }));
  return <><Link href="/notes" className="back-link"><ArrowLeft size={16} /> Back to notes</Link><div className="page-heading"><span className="eyebrow">{note.path}</span><h1>{note.title}</h1><p>Edit the Markdown or follow related notes.</p></div>
    <div className="notes-grid"><section className="panel"><h2>Edit Markdown</h2><form action={updateNote} className="stack"><input type="hidden" name="id" value={note.id} /><textarea className="input code-editor" aria-label="Note content" name="body" rows={18} maxLength={500000} defaultValue={note.body} /><button className="button button-dark" type="submit">Save changes</button></form><hr className="soft-divider" /><h3>Preview</h3><div className="markdown-preview"><ReactMarkdown skipHtml>{note.body}</ReactMarkdown></div></section>
      <aside><section className="panel"><div className="panel-kicker"><Link2 size={17} /> CONNECTIONS</div>{related.length ? <ul className="related-links">{related.map(({ target, match }) => <li key={target}>{match ? <Link href={`/notes/${(all ?? []).find((n) => n.path === match.path)?.id}`}>{target}</Link> : <span>{target} <small>(not imported)</small></span>}</li>)}</ul> : <p className="muted small">Use <code>[[Note name]]</code> in a note to connect ideas.</p>}</section><section className="panel danger-panel"><h3>Delete note</h3><p className="muted small">This permanently deletes this note from Study Tool, not from your original Obsidian vault.</p><form action={removeNote}><input type="hidden" name="id" value={note.id} /><button className="button button-danger">Delete note</button></form></section></aside>
    </div>
  </>;
}
