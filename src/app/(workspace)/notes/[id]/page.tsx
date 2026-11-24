import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NoteMarkdown } from "@/components/NoteMarkdown";
import { requireAccount } from "@/lib/auth";
import { loadNotes } from "@/lib/note-queries";
import { loadSourceAliases, loadSourceRevision } from "@/lib/source-queries";
import { removeNote } from "@/app/actions";
import { NoteEditor } from "@/components/NoteEditor";
import { NoteConnections } from "@/components/NoteConnections";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireAccount();
  const { data: note } = await supabase.from("notes").select("id,path,title,body,updated_at,source_id,artifact:source_artifacts!note_artifact_fk(current_revision_id)").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!note) notFound();
  const artifact = note.artifact as unknown as { current_revision_id: string | null } | null;
  const [all, aliases, original] = await Promise.all([loadNotes(supabase, note.source_id), loadSourceAliases(supabase, note.source_id),
    loadSourceRevision(supabase, artifact?.current_revision_id ?? null)]);
  return <><Link href="/notes" className="back-link"><ArrowLeft size={16} /> Back to notes</Link><div className="page-heading"><span className="eyebrow">{note.path}</span><h1>{note.title}</h1></div>
    <div className="notes-grid"><section className="panel"><h2>Edit Markdown</h2><NoteEditor key={note.id} id={note.id} body={note.body} updatedAt={note.updated_at} /><hr className="soft-divider" /><h3>Preview</h3><div className="markdown-preview"><NoteMarkdown body={note.body} /></div></section>
      <aside><NoteConnections body={note.body} notes={all} aliases={aliases} original={original} /><section className="panel danger-panel"><h3>Delete note</h3><p className="muted small">Deletes the editable note. Source revisions are kept; your vault is unchanged.</p><form action={removeNote}><input type="hidden" name="id" value={note.id} /><button className="button button-danger">Delete note</button></form></section></aside>
    </div>
  </>;
}
